// Centralized application error handler

const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation failed',
      errors: Object.values(err.errors).map((error) => error.message),
    });
  }

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};

// Export error-handling middleware

module.exports = errorHandler;
