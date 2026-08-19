const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;

const BRAND_OPTIONS = [
  'Hi Banana',
  'Rajmata',
  'Banana Man',
];

const LOGIN_ROLE_OPTIONS = [
  'admin',
  'subadmin',
  'vendor',
  'supervisor',
];

const PUBLIC_SIGNUP_ROLE_OPTIONS = [
  'vendor',
  'supervisor',
];

const validateCredentials = (req, res, next) => {
  const role =
    typeof req.body?.role === 'string'
      ? req.body.role.trim().toLowerCase()
      : '';

  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';

  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  const errors = [];

  if (!LOGIN_ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Select Admin, Sub-Admin, Vendor, or Supervisor',
    });
  }

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
    role,
    email,
    password,
  };

  return next();
};

const validateSignupRequest = (req, res, next) => {
  const role =
    typeof req.body?.role === 'string'
      ? req.body.role.trim().toLowerCase()
      : '';

  const brandName =
    typeof req.body?.brandName === 'string'
      ? req.body.brandName.trim()
      : typeof req.body?.companyName === 'string'
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

  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  const confirmPassword =
    typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : '';

  const errors = [];

  if (!PUBLIC_SIGNUP_ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Public signup is available only for Vendor or Supervisor',
    });
  }

  if (!BRAND_OPTIONS.includes(brandName)) {
    errors.push({
      field: 'brandName',
      message: 'Select Hi Banana, Rajmata, or Banana Man',
    });
  }

  if (userName.length < 2) {
    errors.push({
      field: 'userName',
      message: 'Full name is required',
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
    role,
    brandName,
    userName,
    mobileNumber,
    email,
    password,
    confirmPassword,
  };

  return next();
};

module.exports = {
  BRAND_OPTIONS,
  LOGIN_ROLE_OPTIONS,
  PUBLIC_SIGNUP_ROLE_OPTIONS,
  validateCredentials,
  validateSignupRequest,
};
