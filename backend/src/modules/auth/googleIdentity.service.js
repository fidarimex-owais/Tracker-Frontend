// Google identity verification dependencies and configuration

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = [
  'accounts.google.com',
  'https://accounts.google.com',
];

let cachedKeys = [];
let cacheExpiresAt = 0;

// Shared Google authentication helpers

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseMaxAge = (cacheControl = '') => {
  const match = cacheControl.match(/max-age=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 3600;
};

// Retrieve and cache Google's public signing keys

const fetchGoogleKeys = async ({ force = false } = {}) => {
  const now = Date.now();

  if (!force && cachedKeys.length > 0 && cacheExpiresAt > now) {
    return cachedKeys;
  }

  let response;

  try {
    response = await fetch(GOOGLE_JWKS_URL, {
      headers: {
        accept: 'application/json',
      },
    });
  } catch {
    throw createHttpError(
      503,
      'Google identity verification is temporarily unavailable'
    );
  }

  if (!response.ok) {
    throw createHttpError(
      503,
      'Google identity verification is temporarily unavailable'
    );
  }

  const data = await response.json();
  cachedKeys = Array.isArray(data.keys) ? data.keys : [];

  const maxAge = parseMaxAge(response.headers.get('cache-control') || '');
  cacheExpiresAt = now + Math.max(maxAge, 60) * 1000;

  return cachedKeys;
};

// Resolve the public key matching the token key ID

const getSigningKey = async (kid) => {
  let keys = await fetchGoogleKeys();
  let key = keys.find((item) => item.kid === kid);

  if (!key) {
    keys = await fetchGoogleKeys({ force: true });
    key = keys.find((item) => item.kid === kid);
  }

  if (!key) {
    throw createHttpError(401, 'Google identity verification failed');
  }

  return crypto.createPublicKey({
    key,
    format: 'jwk',
  });
};

// Verify the Google ID token and return the verified identity

const verifyGoogleIdToken = async (credential) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw createHttpError(503, 'Google Sign-In is not configured');
  }

  const decoded = jwt.decode(credential, {
    complete: true,
  });

  if (
    !decoded?.header?.kid ||
    decoded.header.alg !== 'RS256'
  ) {
    throw createHttpError(401, 'Google identity verification failed');
  }

  const publicKey = await getSigningKey(decoded.header.kid);
  let payload;

  try {
    payload = jwt.verify(credential, publicKey, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
    });
  } catch {
    throw createHttpError(401, 'Google identity verification failed');
  }

  const email = String(payload.email || '')
    .trim()
    .toLowerCase();

  if (!email || payload.email_verified !== true) {
    throw createHttpError(
      401,
      'Google account email is not verified'
    );
  }

  return {
    googleSubject: payload.sub,
    email,
    name: payload.name || '',
    picture: payload.picture || '',
  };
};

// Export Google identity verification service

module.exports = {
  verifyGoogleIdToken,
};
