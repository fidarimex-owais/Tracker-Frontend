// Rate limiter configuration helpers

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Create an in-memory request rate limiter

const createRateLimiter = ({
  windowMs,
  max,
  message = 'Too many requests. Please try again later.',
}) => {
  const requests = new Map();

  // Periodically remove expired entries so the in-memory store stays small.
  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of requests.entries()) {
      if (entry.resetAt <= now) {
        requests.delete(key);
      }
    }
  }, Math.max(windowMs, 60_000));

  // Do not keep Node.js alive only because of the cleanup timer.
  cleanupTimer.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = requests.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      requests.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(max - entry.count, 0);
    const retryAfterSeconds = Math.max(
      Math.ceil((entry.resetAt - now) / 1000),
      1
    );

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader(
      'RateLimit-Reset',
      String(Math.ceil(entry.resetAt / 1000))
    );

    if (entry.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));

      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    }

    return next();
  };
};

// General API rate limit

const apiRateLimiter = createRateLimiter({
  windowMs: toPositiveInteger(
    process.env.RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
  ),
  max: toPositiveInteger(process.env.RATE_LIMIT_MAX, 350),
  message: 'Too many API requests. Please try again later.',
});

// Login-specific rate limit

const loginRateLimiter = createRateLimiter({
  windowMs: toPositiveInteger(
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
  ),
  max: toPositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX, 20),
  message: 'Too many login attempts. Please try again later.',
});

// Signup-specific rate limit

const signupRateLimiter = createRateLimiter({
  windowMs: toPositiveInteger(
    process.env.SIGNUP_RATE_LIMIT_WINDOW_MS,
    60 * 60 * 1000
  ),
  max: toPositiveInteger(process.env.SIGNUP_RATE_LIMIT_MAX, 25),
  message: 'Too many registration attempts. Please try again later.',
});

module.exports = {
  apiRateLimiter,
  loginRateLimiter,
  signupRateLimiter,
};
