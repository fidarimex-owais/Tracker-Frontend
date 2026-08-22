const authService = require('./auth.service');

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite:
    process.env.NODE_ENV === 'production'
      ? 'none'
      : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const signup = async (req, res) => {
  const request = await authService.signup(req.body);

  res.status(202).json({
    success: true,
    message:
      'Signup request submitted. You can sign in after Admin approval.',
    request,
  });
};

const sendAuthenticatedResponse = (res, user, message) => {
  const token = authService.signToken(user);

  res.cookie('auth_token', token, cookieOptions());

  res.json({
    success: true,
    message,
    user,
    token,
  });
};

const login = async (req, res) => {
  const user = await authService.login(req.body);
  return sendAuthenticatedResponse(res, user, 'Logged in');
};

const googleLogin = async (req, res) => {
  const user = await authService.googleLogin(req.body);
  return sendAuthenticatedResponse(res, user, 'Signed in with Google');
};

const logout = async (req, res) => {
  res.clearCookie('auth_token', cookieOptions());

  res.json({
    success: true,
    message: 'Logged out',
  });
};

const me = async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
};

module.exports = {
  signup,
  login,
  googleLogin,
  logout,
  me,
};
