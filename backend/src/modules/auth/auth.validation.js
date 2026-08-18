const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;

const COMPANY_OPTIONS = [
  'Rajmata',
  'Korhale',
  'Jaywant',
];

const SIGNUP_ROLE_OPTIONS = [
  'vendor',
  'subadmin',
  'supervisor',
];

const validateCredentials = (req, res, next) => {
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';

  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  const errors = [];

  if (!EMAIL_RE.test(email)) {
    errors.push({
      field: 'email',
      message: 'Enter a valid email address',
    });
  }

  if (password.length < 8) {
    errors.push({
      field: 'password',
      message: 'Password must be at least 8 characters',
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = {
    email,
    password,
  };

  return next();
};

const validateSignupRequest = (req, res, next) => {
  const companyName =
    typeof req.body?.companyName === 'string'
      ? req.body.companyName.trim()
      : '';

  const userName =
    typeof req.body?.userName === 'string'
      ? req.body.userName.trim()
      : '';

  const mobileNumber =
    typeof req.body?.mobileNumber === 'string'
      ? req.body.mobileNumber
          .trim()
          .replace(/[\s-]/g, '')
      : '';

  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';

  const role =
    typeof req.body?.role === 'string'
      ? req.body.role.trim().toLowerCase()
      : '';

  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  const confirmPassword =
    typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : '';

  const errors = [];

  if (!COMPANY_OPTIONS.includes(companyName)) {
    errors.push({
      field: 'companyName',
      message: 'Select Rajmata, Korhale, or Jaywant',
    });
  }

  if (userName.length < 2) {
    errors.push({
      field: 'userName',
      message: 'User name is required',
    });
  }

  if (!MOBILE_RE.test(mobileNumber)) {
    errors.push({
      field: 'mobileNumber',
      message: 'Enter a valid mobile number',
    });
  }

  if (!EMAIL_RE.test(email)) {
    errors.push({
      field: 'email',
      message: 'Enter a valid email address',
    });
  }

  if (!SIGNUP_ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Select Vendor, Sub-Admin, or Supervisor',
    });
  }

  if (password.length < 8) {
    errors.push({
      field: 'password',
      message: 'Password must be at least 8 characters',
    });
  }

  if (password !== confirmPassword) {
    errors.push({
      field: 'confirmPassword',
      message: 'Passwords do not match',
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = {
    companyName,
    userName,
    mobileNumber,
    email,
    role,
    password,
    confirmPassword,
  };

  return next();
};

module.exports = {
  COMPANY_OPTIONS,
  SIGNUP_ROLE_OPTIONS,
  validateCredentials,
  validateSignupRequest,
};