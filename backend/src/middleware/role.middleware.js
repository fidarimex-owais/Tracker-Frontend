// Restrict routes to authenticated users with an allowed role

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to access this resource' });
  }
  return next();
};

// Export role authorization middleware

module.exports = authorize;
