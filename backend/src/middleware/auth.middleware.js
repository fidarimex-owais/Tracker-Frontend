// Authentication middleware dependencies

const authService = require('../modules/auth/auth.service');

// Validate the user's session and attach the authenticated user to the request

const authMiddleware = async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.auth_token;
    const authHeader = req.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const payload = authService.verifyToken(token);
    req.user = await authService.getUserById(payload.sub);
    return next();
  } catch (error) {
    const status = error.statusCode || 401;
    return res.status(status).json({ success: false, message: status === 401 ? 'Invalid or expired session' : error.message });
  }
};

// Export authentication middleware

module.exports = authMiddleware;
