// Authentication service layer

const authService = require('./auth.service');

// Configure session or persistent authentication cookies

const cookieOptions = (rememberMe = false) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite:
      process.env.NODE_ENV === 'production'
        ? 'none'
        : 'lax',
  };

  // Without "Remember me" this is a browser-session cookie.
  // With "Remember me" it persists for 7 days.
  if (rememberMe) {
    options.maxAge = 7 * 24 * 60 * 60 * 1000;
  }

  return options;
};

// Submit a public signup request

const signup = async (req, res) => {
  const request = await authService.signup(req.body);

  res.status(202).json({
    success: true,
    message:
      'Signup request submitted. You can sign in after the request is approved.',
    request,
  });
};


const listVendors = async (req, res) => {
  const vendors = await authService.listVendorOptions();

  res.json({
    success: true,
    vendors,
  });
};

// Set the authentication cookie and return the signed-in user

const sendAuthenticatedResponse = (
  res,
  user,
  message,
  rememberMe = false
) => {
  const token = authService.signToken(user);

  res.cookie(
    'auth_token',
    token,
    cookieOptions(rememberMe)
  );

  res.json({
    success: true,
    message,
    user,
    token,
  });
};

// Standard login handler

const login = async (req, res) => {
  const user = await authService.login(req.body);

  return sendAuthenticatedResponse(
    res,
    user,
    'Logged in',
    req.body.rememberMe
  );
};

// Google Sign-In handler

const googleLogin = async (req, res) => {
  const user = await authService.googleLogin(req.body);

  return sendAuthenticatedResponse(
    res,
    user,
    'Signed in with Google',
    req.body.rememberMe
  );
};

// Clear the authentication session

const logout = async (req, res) => {
  res.clearCookie('auth_token', cookieOptions(false));

  res.json({
    success: true,
    message: 'Logged out',
  });
};

// Return the currently authenticated user

const me = async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
};

// Update the current account's own profile

const updateProfile = async (req, res) => {
  const user = await authService.updateProfile(
    req.user.id,
    req.body
  );

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user,
  });
};

// Export authentication controller handlers

module.exports = {
  signup,
  listVendors,
  login,
  googleLogin,
  logout,
  me,
  updateProfile,
};
