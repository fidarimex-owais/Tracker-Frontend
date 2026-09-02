const AUTOCOMPLETE_URL =
  'https://api.geoapify.com/v1/geocode/autocomplete';
const GEOCODE_SEARCH_URL =
  'https://api.geoapify.com/v1/geocode/search';
const ROUTING_URL = 'https://api.geoapify.com/v1/routing';

const cache = new Map();
const AUTOCOMPLETE_TTL_MS = 5 * 60 * 1000;
const POSTCODE_TTL_MS = 60 * 60 * 1000;
const ROUTE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_COUNTRY_BIAS = 'in';

// Open Location Code / Plus Code alphabet. Short codes such as MXHH+J5X
// require a nearby reference location, so they are not useful as ordinary
// free-form address text for Geoapify. We keep them in the user's input but
// remove them from address-search variants when a normal locality/postcode is
// also present.
const PLUS_CODE_RE = /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/gi;
const INDIA_POSTCODE_RE = /\b([1-9][0-9]{5})\b/;

const getApiKey = () => {
  const key = String(process.env.GEOAPIFY_API_KEY || '').trim();

  if (!key) {
    throw createHttpError(
      503,
      'GEOAPIFY_API_KEY is not configured on the backend'
    );
  }

  return key;
};

const getCountryBias = () => {
  const configured = String(
    process.env.GEOAPIFY_COUNTRY_BIAS || DEFAULT_COUNTRY_BIAS
  )
    .trim()
    .toLowerCase();

  return /^[a-z]{2}$/.test(configured) ? configured : DEFAULT_COUNTRY_BIAS;
};

const getCached = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

const setCached = (key, value, ttlMs) => {
  if (cache.size > 300) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `Geoapify request failed with status ${response.status}`;
      throw createHttpError(502, message);
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createHttpError(504, 'Geoapify request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeForMatch = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (value) =>
  normalizeForMatch(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);

const cleanPunctuation = (value) =>
  String(value || '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const extractSearchContext = (query) => {
  const postcodeMatch = String(query).match(INDIA_POSTCODE_RE);
  const postcode = postcodeMatch?.[1] || '';
  const plusCodes = String(query).match(PLUS_CODE_RE) || [];

  const withoutPlusCode = cleanPunctuation(
    String(query).replace(PLUS_CODE_RE, ' ')
  );

  // For searches constrained to the postcode boundary, duplicate context such
  // as the postcode/state/country can make the street query less precise.
  const coreAddress = cleanPunctuation(
    withoutPlusCode
      .replace(INDIA_POSTCODE_RE, ' ')
      .replace(/\bmaharashtra\b/gi, ' ')
      .replace(/\bindia\b/gi, ' ')
  );

  const normalizedQuery = normalizeForMatch(query);

  return {
    postcode,
    plusCodes,
    withoutPlusCode,
    coreAddress,
    expectsMaharashtra: /\bmaharashtra\b/i.test(query),
    normalizedQuery,
  };
};

const normalizeSuggestion = (item, query, source) => {
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const formatted =
    item.formatted ||
    [item.address_line1, item.address_line2].filter(Boolean).join(', ') ||
    query;

  return {
    placeId: String(item.place_id || ''),
    name: String(item.name || item.address_line1 || '').trim(),
    formatted,
    latitude,
    longitude,
    city: item.city || item.town || item.village || item.county || '',
    county: item.county || '',
    state: item.state || '',
    postcode: item.postcode || '',
    country: item.country || '',
    countryCode: item.country_code || '',
    resultType: item.result_type || '',
    source,
  };
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceKmBetween = (a, b) => {
  if (!a || !b) return null;

  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadiusKm = 6371.0088;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

const scoreSuggestion = (suggestion, query, context, postcodeContext) => {
  const queryNormalized = normalizeForMatch(query);
  const searchNormalized = normalizeForMatch(context.withoutPlusCode || query);
  const formattedNormalized = normalizeForMatch(suggestion.formatted);
  const nameNormalized = normalizeForMatch(suggestion.name);
  const queryTokens = tokenize(context.withoutPlusCode || query);
  const haystackTokens = new Set(
    tokenize(`${suggestion.name} ${suggestion.formatted}`)
  );

  let score = 0;

  if (formattedNormalized === queryNormalized) score += 180;
  if (formattedNormalized === searchNormalized) score += 170;
  if (nameNormalized && nameNormalized === searchNormalized) score += 155;
  if (formattedNormalized.startsWith(searchNormalized)) score += 95;
  if (nameNormalized && searchNormalized.startsWith(nameNormalized)) score += 35;
  if (nameNormalized && searchNormalized.includes(nameNormalized)) score += 30;

  if (queryTokens.length > 0) {
    const matched = queryTokens.filter((token) => haystackTokens.has(token));
    score += (matched.length / queryTokens.length) * 90;
  }

  if (context.postcode) {
    if (suggestion.postcode === context.postcode) {
      score += 220;
    } else if (suggestion.postcode) {
      // A different explicit PIN should never outrank the requested PIN merely
      // because a city/village has the same name.
      score -= 180;
    }
  }

  if (context.expectsMaharashtra) {
    const state = normalizeForMatch(suggestion.state);
    if (state.includes('maharashtra')) score += 70;
    else if (state) score -= 55;
  }

  if (postcodeContext) {
    const km = distanceKmBetween(suggestion, postcodeContext);

    if (km !== null) {
      if (km <= 3) score += 150;
      else if (km <= 10) score += 125;
      else if (km <= 25) score += 95;
      else if (km <= 50) score += 55;
      else if (km <= 100) score += 10;
      else if (km <= 250) score -= 90;
      else score -= 180;
    }
  }

  if (suggestion.resultType === 'amenity') score += 35;
  if (suggestion.resultType === 'building') score += 30;
  if (suggestion.resultType === 'street') score += 28;
  if (suggestion.resultType === 'locality') score -= 8;

  if (suggestion.source === 'postcode-place') score += 120;
  if (suggestion.source === 'postcode-proximity') score += 45;
  if (suggestion.source === 'geocode') score += 10;

  if (String(suggestion.countryCode).toLowerCase() === getCountryBias()) {
    score += 20;
  }

  return score;
};

const dedupeAndRankSuggestions = (
  suggestions,
  query,
  context,
  postcodeContext
) => {
  const unique = new Map();

  suggestions.forEach((suggestion) => {
    if (!suggestion) return;

    const coordinateKey = `${suggestion.latitude.toFixed(6)},${suggestion.longitude.toFixed(6)}`;
    const placeKey = suggestion.placeId
      ? `place:${suggestion.placeId}`
      : `coord:${coordinateKey}`;
    const score = scoreSuggestion(
      suggestion,
      query,
      context,
      postcodeContext
    );
    const current = unique.get(placeKey);

    if (!current || score > current.score) {
      unique.set(placeKey, { suggestion, score });
    }
  });

  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ suggestion }) => suggestion);
};

const resolvePostcodeContext = async (postcode, countryCode) => {
  if (!postcode || countryCode !== 'in') return null;

  const cacheKey = `postcode:${countryCode}:${postcode}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  const params = new URLSearchParams({
    text: postcode,
    type: 'postcode',
    limit: '5',
    format: 'json',
    lang: 'en',
    filter: `countrycode:${countryCode}`,
    apiKey: getApiKey(),
  });

  try {
    const payload = await fetchJson(`${GEOCODE_SEARCH_URL}?${params}`);
    const items = Array.isArray(payload?.results) ? payload.results : [];

    const exact =
      items.find((item) => String(item?.postcode || '') === postcode) ||
      items[0];

    if (!exact) {
      setCached(cacheKey, null, POSTCODE_TTL_MS);
      return null;
    }

    const normalized = normalizeSuggestion(
      exact,
      `${postcode}, India`,
      'postcode-context'
    );

    if (!normalized) {
      setCached(cacheKey, null, POSTCODE_TTL_MS);
      return null;
    }

    const result = {
      ...normalized,
      postcode: String(exact.postcode || postcode),
    };

    setCached(cacheKey, result, POSTCODE_TTL_MS);
    return result;
  } catch {
    // Postcode resolution improves ranking, but failure should not make the
    // whole autocomplete unavailable. Fall back to normal Geoapify search.
    setCached(cacheKey, null, 60 * 1000);
    return null;
  }
};

const buildGeoapifyUrl = (endpoint, text, options = {}) => {
  const params = new URLSearchParams({
    text,
    limit: String(options.limit || 10),
    format: 'json',
    lang: 'en',
    apiKey: getApiKey(),
  });

  if (options.filter) params.set('filter', options.filter);
  if (options.bias) params.set('bias', options.bias);

  return `${endpoint}?${params}`;
};

const autocompleteAddress = async (text) => {
  const query = String(text || '').trim();

  if (query.length < 3 || query.length > 200) {
    throw createHttpError(
      400,
      'Address search text must be between 3 and 200 characters'
    );
  }

  const countryBias = getCountryBias();
  const context = extractSearchContext(query);
  const cacheKey = `autocomplete:v3:${countryBias}:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const postcodeContext = await resolvePostcodeContext(
    context.postcode,
    countryBias
  );

  const countryFilter = `countrycode:${countryBias}`;
  const proximityBias = postcodeContext
    ? `proximity:${postcodeContext.longitude},${postcodeContext.latitude}`
    : `countrycode:${countryBias}`;

  const mainQuery = context.withoutPlusCode || query;
  const requests = [
    {
      source: 'autocomplete',
      promise: fetchJson(
        buildGeoapifyUrl(AUTOCOMPLETE_URL, mainQuery, {
          filter: countryFilter,
          bias: proximityBias,
          limit: 12,
        })
      ),
    },
    {
      source: 'geocode',
      promise: fetchJson(
        buildGeoapifyUrl(GEOCODE_SEARCH_URL, mainQuery, {
          filter: countryFilter,
          bias: proximityBias,
          limit: 12,
        })
      ),
    },
  ];

  // When a PIN has been supplied, ask Geoapify for an additional search
  // specifically inside that postcode boundary. This prevents similarly named
  // villages elsewhere in India from winning the result list.
  if (postcodeContext?.placeId && context.coreAddress.length >= 3) {
    const placeFilter = `place:${postcodeContext.placeId}`;

    requests.push(
      {
        source: 'postcode-place',
        promise: fetchJson(
          buildGeoapifyUrl(GEOCODE_SEARCH_URL, context.coreAddress, {
            filter: placeFilter,
            bias: proximityBias,
            limit: 10,
          })
        ),
      },
      {
        source: 'postcode-proximity',
        promise: fetchJson(
          buildGeoapifyUrl(AUTOCOMPLETE_URL, context.coreAddress, {
            filter: countryFilter,
            bias: proximityBias,
            limit: 10,
          })
        ),
      }
    );
  }

  const settled = await Promise.allSettled(
    requests.map((request) => request.promise)
  );

  if (settled.every((result) => result.status === 'rejected')) {
    const firstFailure = settled.find((result) => result.status === 'rejected');
    throw firstFailure?.reason || createHttpError(502, 'Geoapify search failed');
  }

  const combined = [];

  settled.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;

    const items = Array.isArray(result.value?.results)
      ? result.value.results
      : [];
    const source = requests[index].source;

    items.forEach((item) => {
      combined.push(normalizeSuggestion(item, query, source));
    });
  });

  const suggestions = dedupeAndRankSuggestions(
    combined,
    query,
    context,
    postcodeContext
  );

  setCached(cacheKey, suggestions, AUTOCOMPLETE_TTL_MS);
  return suggestions;
};

const normalizeCoordinate = (value, min, max, label) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createHttpError(400, `${label} is invalid`);
  }

  return number;
};

const calculateRouteDistance = async ({ from, to }) => {
  const fromLat = normalizeCoordinate(
    from?.latitude,
    -90,
    90,
    'from latitude'
  );
  const fromLon = normalizeCoordinate(
    from?.longitude,
    -180,
    180,
    'from longitude'
  );
  const toLat = normalizeCoordinate(
    to?.latitude,
    -90,
    90,
    'to latitude'
  );
  const toLon = normalizeCoordinate(
    to?.longitude,
    -180,
    180,
    'to longitude'
  );

  const routeKey = `route:${fromLat.toFixed(6)},${fromLon.toFixed(6)}:${toLat.toFixed(6)},${toLon.toFixed(6)}`;
  const cached = getCached(routeKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    waypoints: `${fromLat},${fromLon}|${toLat},${toLon}`,
    mode: 'drive',
    format: 'json',
    units: 'metric',
    apiKey: getApiKey(),
  });

  const payload = await fetchJson(`${ROUTING_URL}?${params}`);
  const route = Array.isArray(payload?.results)
    ? payload.results[0]
    : null;

  if (!route || !Number.isFinite(Number(route.distance))) {
    throw createHttpError(
      422,
      'Geoapify could not calculate a driving route between these locations'
    );
  }

  const distanceMeters = Math.round(Number(route.distance));
  const durationSeconds = Number.isFinite(Number(route.time))
    ? Math.round(Number(route.time))
    : null;

  const result = {
    distanceMeters,
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    durationSeconds,
    durationMinutes:
      durationSeconds === null
        ? null
        : Math.max(1, Math.round(durationSeconds / 60)),
    mode: 'drive',
  };

  setCached(routeKey, result, ROUTE_TTL_MS);
  return result;
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  autocompleteAddress,
  calculateRouteDistance,
};
