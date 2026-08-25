// Authentication service dependencies

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  BRAND_OPTIONS,
  getEffectiveBrand,
  getUserModel,
  ensureCredentialCollection,
  findUserByEmail,
  findUserById,
} = require('./auth.model');

const {
  getSignupRequestModel,
  getApproverRolesForRequestRole,
  findSignupRequestByEmail,
} = require('./signupRequest.model');

const { verifyGoogleIdToken } = require('./googleIdentity.service');

// Password hashing configuration

const SALT_ROUNDS = 12;

// Build safe user and signup-request responses

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  userName: user.userName || '',
  brandName: getEffectiveBrand(user),
  mobileNumber: user.mobileNumber || '',
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sanitizeSignupRequest = (request) => ({
  id: request._id.toString(),
  brandName: request.brandName,
  userName: request.userName,
  mobileNumber: request.mobileNumber,
  email: request.email,
  role: request.role,
  status: request.status,
  eligibleApproverRoles: request.eligibleApproverRoles || [],
  createdAt: request.createdAt,
});

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Verify account status, role, and required brand assignment

const assertUserCanAccessPortal = (user, requestedRole) => {
  if (!user || user.role !== requestedRole) {
    throw createHttpError(401, 'Invalid role or account');
  }

  if (!user.isActive) {
    throw createHttpError(403, 'This account has been deactivated');
  }

  if (
    ['vendor', 'supervisor'].includes(user.role) &&
    !BRAND_OPTIONS.includes(getEffectiveBrand(user))
  ) {
    throw createHttpError(
      403,
      'This account does not have a valid brand assignment. Contact an Admin or Sub-Admin.'
    );
  }
};

// Create a pending Vendor or Supervisor signup request

const signup = async ({
  brandName,
  userName,
  mobileNumber,
  email,
  role,
  password,
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!BRAND_OPTIONS.includes(brandName)) {
    throw createHttpError(400, 'Select a valid brand');
  }

  const eligibleApproverRoles =
    getApproverRolesForRequestRole(role);

  if (eligibleApproverRoles.length === 0) {
    throw createHttpError(
      403,
      'Public signup is available only for Vendor or Supervisor'
    );
  }

  const [existingUser, existingSignupRequest] = await Promise.all([
    findUserByEmail(normalizedEmail),
    findSignupRequestByEmail(normalizedEmail),
  ]);

  if (existingUser || existingSignupRequest) {
    throw createHttpError(
      409,
      'This email address is already registered.'
    );
  }

  const SignupRequest = getSignupRequestModel();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let request;

  try {
    request = await SignupRequest.create({
      brandName,
      userName,
      mobileNumber,
      email: normalizedEmail,
      role,
      passwordHash,
      eligibleApproverRoles,
      status: 'pending',
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(
        409,
        'This email address is already registered.'
      );
    }

    throw error;
  }

  return sanitizeSignupRequest(request);
};

// Authenticate users with email and password

const login = async ({ role, email, password }) => {
  const user = await findUserByEmail(email, {
    includePassword: true,
  });

  if (!user) {
    throw createHttpError(401, 'Invalid email or password');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    throw createHttpError(401, 'Invalid role, email, or password');
  }

  assertUserCanAccessPortal(user, role);

  return sanitizeUser(user);
};

// Authenticate registered Vendor or Supervisor accounts with Google

const googleLogin = async ({ role, credential }) => {
  if (!['vendor', 'supervisor'].includes(role)) {
    throw createHttpError(
      403,
      'Google Sign-In is available only for Vendor or Supervisor'
    );
  }

  const googleIdentity = await verifyGoogleIdToken(credential);
  const user = await findUserByEmail(googleIdentity.email);

  if (!user) {
    throw createHttpError(
      401,
      'No registered account was found for this Google email'
    );
  }

  assertUserCanAccessPortal(user, role);

  return sanitizeUser(user);
};

// Retrieve and validate an authenticated user

const getUserById = async (id) => {
  const user = await findUserById(id);

  if (!user) {
    throw createHttpError(401, 'User account no longer exists');
  }

  if (!user.isActive) {
    throw createHttpError(403, 'This account has been deactivated');
  }

  if (
    ['vendor', 'supervisor'].includes(user.role) &&
    !BRAND_OPTIONS.includes(getEffectiveBrand(user))
  ) {
    throw createHttpError(
      403,
      'This account does not have a valid brand assignment. Contact an Admin or Sub-Admin.'
    );
  }

  return sanitizeUser(user);
};

// Create and verify JWT authentication tokens

const signToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      sub: user.id,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.verify(token, secret);
};

// Create or repair the bootstrap Admin account from environment variables

const ensureAdminUser = async () => {
  await ensureCredentialCollection();

  const email =
    process.env.ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

  const password =
    process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      'ADMIN_EMAIL or ADMIN_PASSWORD is not configured; bootstrap admin was not created.'
    );

    return;
  }

  if (password.length < 8) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 8 characters'
    );
  }

  const existing = await findUserByEmail(
    email,
    {
      includePassword: true,
    }
  );

  if (existing) {
    let changed = false;

    if (existing.role !== 'admin') {
      existing.role = 'admin';
      changed = true;
    }

    if (!existing.isActive) {
      existing.isActive = true;
      changed = true;
    }

    if (changed) {
      await existing.save();
    }

    return;
  }

  const User = getUserModel();
  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  await User.create({
    email,
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  console.log(
    `Bootstrap admin created in user_credentials.credentials: ${email}`
  );
};


// Export authentication service functions

module.exports = {
  signup,
  login,
  googleLogin,
  getUserById,
  signToken,
  verifyToken,
  ensureAdminUser,
  sanitizeUser,
};
