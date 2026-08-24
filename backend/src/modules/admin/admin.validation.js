const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;

const BRAND_OPTIONS = [
  'Hi Banana',
  'Joker',
  'Banana Man',
];

const ROLE_OPTIONS = [
  'vendor',
  'subadmin',
  'supervisor',
];

const BRAND_REQUIRED_ROLES = [
  'vendor',
  'supervisor',
];

const validateCreateId = (req, res, next) => {
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

  if (!ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Select Vendor, Sub-Admin, or Supervisor',
    });
  }

  if (
    BRAND_REQUIRED_ROLES.includes(role) &&
    !BRAND_OPTIONS.includes(brandName)
  ) {
    errors.push({
      field: 'brandName',
      message: 'Select Hi Banana, Joker, or Banana Man',
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
      message: 'Please enter a valid email address.',
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
    brandName: BRAND_REQUIRED_ROLES.includes(role)
      ? brandName
      : '',
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
  BRAND_OPTIONS,
  ROLE_OPTIONS,
  BRAND_REQUIRED_ROLES,
  validateCreateId,
};
