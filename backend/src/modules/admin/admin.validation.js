// Validation patterns for email, mobile numbers and Vendor relationships

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const { validateIdentityPayload } = require('../identity/identity.validation');

const ROLE_OPTIONS = [
  'vendor',
  'subadmin',
  'supervisor',
];

// Validate and normalize portal-created user account data.
// Vendor IDs never accept a brand. Supervisor IDs require a Vendor unless the
// currently signed-in creator is that Vendor, in which case the relationship is
// assigned automatically by the service layer.

const validateCreateId = (req, res, next) => {
  const role =
    typeof req.body?.role === 'string'
      ? req.body.role.trim().toLowerCase()
      : '';

  const vendorId =
    typeof req.body?.vendorId === 'string'
      ? req.body.vendorId.trim()
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

  const identity = validateIdentityPayload(req.body);
  const errors = [...identity.errors];

  if (!ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Select Vendor, Sub-Admin, or Supervisor',
    });
  }

  if (
    role === 'supervisor' &&
    req.user?.role !== 'vendor' &&
    !OBJECT_ID_RE.test(vendorId)
  ) {
    errors.push({
      field: 'vendorId',
      message: 'Select a Vendor',
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
    vendorId: role === 'supervisor' ? vendorId : '',
    userName,
    mobileNumber,
    email,
    role,
    password,
    confirmPassword,
    panNumber: identity.panNumber,
    aadhaarNumber: identity.aadhaarNumber,
    documents: identity.documents,
  };

  return next();
};

module.exports = {
  ROLE_OPTIONS,
  validateCreateId,
};
