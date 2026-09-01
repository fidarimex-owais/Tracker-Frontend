// Validation patterns and supported authentication options

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const MOBILE_RE = /^\+?[0-9]{7,15}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const { validateIdentityPayload } = require('../identity/identity.validation');

const LOGIN_ROLE_OPTIONS = [
  'admin',
  'subadmin',
  'vendor',
  'supervisor',
];

const PUBLIC_SIGNUP_ROLE_OPTIONS = ['supervisor'];

const GOOGLE_LOGIN_ROLE_OPTIONS = [
  'vendor',
  'supervisor',
];

// Email validation helpers

const isValidEmail = (email) => EMAIL_RE.test(email);
const isValidGmail = (email) =>
  isValidEmail(email) && email.endsWith('@gmail.com');

// Validate standard email/password login requests

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

  const rememberMe = req.body?.rememberMe === true;

  const errors = [];

  if (!LOGIN_ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Select Admin, Sub-Admin, Vendor, or Supervisor',
    });
  }

  if (!isValidEmail(email)) {
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
    rememberMe,
  };

  return next();
};

// Validate Google Sign-In requests

const validateGoogleCredentials = (req, res, next) => {
  const role =
    typeof req.body?.role === 'string'
      ? req.body.role.trim().toLowerCase()
      : '';

  const credential =
    typeof req.body?.credential === 'string'
      ? req.body.credential.trim()
      : '';

  const rememberMe = req.body?.rememberMe === true;

  const errors = [];

  if (!GOOGLE_LOGIN_ROLE_OPTIONS.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Google Sign-In is available only for Vendor or Supervisor',
    });
  }

  if (credential.length < 20) {
    errors.push({
      field: 'google',
      message: 'Google identity credential is required',
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
    credential,
    rememberMe,
  };

  return next();
};

// Validate and normalize public signup requests

const validateSignupRequest = (req, res, next) => {
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

  const termsAccepted = req.body?.termsAccepted === true;

  // Public self-registration is intentionally restricted to Supervisors.
  // Vendor and Sub-Admin IDs must be created through authorized portal flows.
  if (!PUBLIC_SIGNUP_ROLE_OPTIONS.includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'Public registration is available only for Supervisor accounts.',
      errors: [
        {
          field: 'role',
          message: 'Only Supervisor accounts can self-register',
        },
      ],
    });
  }

  const identity = validateIdentityPayload(req.body);
  const errors = [...identity.errors];

  if (!OBJECT_ID_RE.test(vendorId)) {
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

  if (!isValidGmail(email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid Gmail address.',
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

  if (!termsAccepted) {
    errors.push({
      field: 'termsAccepted',
      message:
        'You must agree to the Terms & Conditions before registering.',
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
    vendorId,
    companyName: '',
    userName,
    mobileNumber,
    email,
    password,
    confirmPassword,
    termsAccepted,
    panNumber: identity.panNumber,
    aadhaarNumber: identity.aadhaarNumber,
    documents: identity.documents,
  };

  return next();
};

// Validate updates to the currently authenticated user's profile

const PROFILE_IMAGE_RE =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

const getDataUrlByteSize = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const padding = (base64.match(/=*$/)?.[0] || '').length;

  return Math.max(
    0,
    Math.floor((base64.length * 3) / 4) - padding
  );
};

const validateProfileUpdate = (req, res, next) => {
  const fullName =
    typeof req.body?.fullName === 'string'
      ? req.body.fullName.trim()
      : '';

  const mobileNumber =
    typeof req.body?.mobileNumber === 'string'
      ? req.body.mobileNumber
          .trim()
          .replace(/[\s-]/g, '')
      : '';

  const profilePicture =
    typeof req.body?.profilePicture === 'string'
      ? req.body.profilePicture.trim()
      : '';

  const errors = [];

  if (fullName.length < 2 || fullName.length > 80) {
    errors.push({
      field: 'fullName',
      message: 'Full name must be between 2 and 80 characters',
    });
  }

  if (!MOBILE_RE.test(mobileNumber)) {
    errors.push({
      field: 'mobileNumber',
      message: 'Enter a valid mobile number',
    });
  }

  if (profilePicture) {
    if (!PROFILE_IMAGE_RE.test(profilePicture)) {
      errors.push({
        field: 'profilePicture',
        message: 'Profile picture must be a PNG, JPG, or WebP image',
      });
    } else if (getDataUrlByteSize(profilePicture) > 1024 * 1024) {
      errors.push({
        field: 'profilePicture',
        message: 'Profile picture must be 1 MB or smaller',
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = {
    fullName,
    mobileNumber,
    profilePicture,
  };

  return next();
};

// Export authentication validation helpers

module.exports = {
  LOGIN_ROLE_OPTIONS,
  PUBLIC_SIGNUP_ROLE_OPTIONS,
  GOOGLE_LOGIN_ROLE_OPTIONS,
  isValidEmail,
  isValidGmail,
  validateCredentials,
  validateGoogleCredentials,
  validateSignupRequest,
  validateProfileUpdate,
};
