const ALLOWED_BRANDS = ['Hi Banana', 'Joker', 'Banana Man'];

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isValidISODate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

const HAND_CATEGORIES = [4, 5, 6, 8];

/**
 * quantities must look like: { "4": 50, "5": 70, "6": 120, "8": 600 }
 * - Keys outside 4/5/6/8 are rejected.
 * - Each present value must be a non-negative integer.
 * - At least one category must have quantity > 0, or there's nothing to
 *   generate.
 * - A category with quantity 0 or omitted entirely is simply skipped.
 */
const validateQuantities = (quantities, errors) => {
  if (typeof quantities !== 'object' || quantities === null || Array.isArray(quantities)) {
    errors.push({ field: 'quantities', message: 'quantities is required and must be an object' });
    return;
  }

  const keys = Object.keys(quantities);
  const unknownKeys = keys.filter((k) => !HAND_CATEGORIES.includes(Number(k)));
  if (unknownKeys.length > 0) {
    errors.push({
      field: 'quantities',
      message: `quantities has unknown keys: ${unknownKeys.join(', ')}. Only 4, 5, 6, 8 are allowed.`,
    });
  }

  let anyPositive = false;
  for (const cat of HAND_CATEGORIES) {
    const val = quantities[cat] ?? quantities[String(cat)];
    if (val === undefined) continue; // omitted = 0, allowed
    if (!Number.isInteger(val) || val < 0) {
      errors.push({
        field: `quantities.${cat}`,
        message: `quantities.${cat} must be a non-negative integer`,
      });
      continue;
    }
    if (val > 0) anyPositive = true;
  }

  if (anyPositive === false && unknownKeys.length === 0) {
    errors.push({
      field: 'quantities',
      message: 'At least one hand category must have a quantity greater than 0',
    });
  }
};

const validateLineFields = (body, errors) => {
  if (!isNonEmptyString(body.brandName)) {
    errors.push({ field: 'brandName', message: 'brandName is required and must be a string' });
  } else if (!ALLOWED_BRANDS.includes(body.brandName)) {
    errors.push({ field: 'brandName', message: `brandName must be one of: ${ALLOWED_BRANDS.join(', ')}` });
  }
  if (!isNonEmptyString(body.vendorName)) {
    errors.push({ field: 'vendorName', message: 'vendorName is required and must be a string' });
  }
  if (!isNonEmptyString(body.farmerName)) {
    errors.push({ field: 'farmerName', message: 'farmerName is required and must be a string' });
  }
  if (!isNonEmptyString(body.supervisor)) {
    errors.push({ field: 'supervisor', message: 'supervisor is required and must be a string' });
  }
  if (!isFiniteNumber(body.lineNumber) || body.lineNumber <= 0) {
    errors.push({ field: 'lineNumber', message: 'lineNumber is required and must be a positive number' });
  }
  if (!isFiniteNumber(body.weight) || body.weight <= 0) {
    errors.push({ field: 'weight', message: 'weight is required and must be a positive number' });
  }
  if (!isNonEmptyString(body.address)) {
    errors.push({ field: 'address', message: 'address is required and must be a string' });
  }
  if (!isValidISODate(body.packageDate)) {
    errors.push({ field: 'packageDate', message: 'packageDate is required and must be a valid date (YYYY-MM-DD)' });
  }
  if (typeof body.geolocation !== 'object' || body.geolocation === null) {
    errors.push({ field: 'geolocation', message: 'geolocation is required and must be an object' });
  } else {
    const { latitude, longitude } = body.geolocation;
    if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
      errors.push({ field: 'geolocation.latitude', message: 'latitude must be a number between -90 and 90' });
    }
    if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
      errors.push({ field: 'geolocation.longitude', message: 'longitude must be a number between -180 and 180' });
    }
  }
};

/**
 * POST /api/records — same as before, numberOfHands still excluded.
 */
const validateSubmitLine = (req, res, next) => {
  const body = req.body || {};
  const errors = [];
  validateLineFields(body, errors);
  validateQuantities(body.quantities || {}, errors);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  const normalizedQuantities = {};
  for (const cat of HAND_CATEGORIES) {
    const val = body.quantities[cat] ?? body.quantities[String(cat)] ?? 0;
    normalizedQuantities[cat] = val;
  }

  req.body = {
    brandName: body.brandName,
    vendorName: body.vendorName.trim(),
    farmerName: body.farmerName.trim(),
    supervisor: body.supervisor.trim(),
    lineNumber: body.lineNumber,
    weight: body.weight,
    address: body.address.trim(),
    packageDate: new Date(body.packageDate),
    geolocation: {
      latitude: body.geolocation.latitude,
      longitude: body.geolocation.longitude,
    },
    quantities: normalizedQuantities,
  };

  next();
};

/**
 * POST /api/records/resolve
 * Body shape: { brandName, packageDate, lineNumber, action, payload? }
 * `payload` (full line fields) is REQUIRED when action === 'update', not
 * needed when action === 'reuse' (nothing is written in that case).
 */
const validateResolveConflict = (req, res, next) => {
  const body = req.body || {};
  const errors = [];

  if (!isNonEmptyString(body.brandName) || !ALLOWED_BRANDS.includes(body.brandName)) {
    errors.push({ field: 'brandName', message: `brandName must be one of: ${ALLOWED_BRANDS.join(', ')}` });
  }
  if (!isValidISODate(body.packageDate)) {
    errors.push({ field: 'packageDate', message: 'packageDate is required and must be a valid date' });
  }
  if (!isFiniteNumber(body.lineNumber) || body.lineNumber <= 0) {
    errors.push({ field: 'lineNumber', message: 'lineNumber is required and must be a positive number' });
  }
  if (body.action !== 'reuse' && body.action !== 'update') {
    errors.push({ field: 'action', message: 'action must be either "reuse" or "update"' });
  }

  if (body.action === 'update') {
    if (typeof body.payload !== 'object' || body.payload === null) {
      errors.push({ field: 'payload', message: 'payload is required when action is "update"' });
    } else {
      validateLineFields(
        { ...body.payload, brandName: body.brandName, packageDate: body.packageDate, lineNumber: body.lineNumber },
        errors
      );
      validateQuantities(body.payload.quantities || {}, errors);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = {
    brandName: body.brandName,
    packageDate: new Date(body.packageDate),
    lineNumber: body.lineNumber,
    action: body.action,
    payload:
      body.action === 'update'
        ? {
            vendorName: body.payload.vendorName.trim(),
            farmerName: body.payload.farmerName.trim(),
            supervisor: body.payload.supervisor.trim(),
            weight: body.payload.weight,
            address: body.payload.address.trim(),
            geolocation: {
              latitude: body.payload.geolocation.latitude,
              longitude: body.payload.geolocation.longitude,
            },
            quantities: (() => {
              const q = {};
              for (const cat of HAND_CATEGORIES) {
                q[cat] = body.payload.quantities[cat] ?? body.payload.quantities[String(cat)] ?? 0;
              }
              return q;
            })(),
          }
        : null,
  };

  next();
};

module.exports = { validateSubmitLine, validateResolveConflict };