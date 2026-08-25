// Forward rejected async route handlers to the centralized error handler

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Export the async handler wrapper

module.exports = asyncHandler;
