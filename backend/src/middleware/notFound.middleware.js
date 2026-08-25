// Handle requests that do not match an existing route

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

// Export the not-found middleware

module.exports = notFound;
