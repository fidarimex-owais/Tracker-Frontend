const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateCredentials = (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const errors = [];

  if (!EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'Enter a valid email address' });
  }

  if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body.email = email;
  req.body.password = password;
  return next();
};

module.exports = { validateCredentials };
