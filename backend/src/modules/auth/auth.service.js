// Authentication service dependencies

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  getUserModel,
  ensureCredentialCollection,
  findUserByEmail,
  findUserById,
  findActiveVendorById,
  listActiveVendors,
} = require('./auth.model');

const {
  getSignupRequestModel,
  getApproverRolesForRequestRole,
  findSignupRequestByEmail,
} = require('./signupRequest.model');

const { verifyGoogleIdToken } = require('./googleIdentity.service');

const {
  createIdentityRecord,
  cleanupIdentityRecord,
} = require('../identity/identity.service');

// Password hashing configuration

const SALT_ROUNDS = 12;

// Build safe user and signup-request responses

const buildProfileId = (user) => {
  const rawId = String(user?._id || user?.id || '');

  return rawId
    ? `FID-${rawId.slice(-12).toUpperCase()}`
    : '';
};

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  profileId: buildProfileId(user),
  userName: user.userName || '',
  fullName: user.userName || '',
  brandName: '',
  companyName: user.companyName || '',
  vendorId: user.vendorId ? user.vendorId.toString() : '',
  vendorName: user.vendorName || '',
  mobileNumber: user.mobileNumber || '',
  email: user.email,
  profilePicture: user.profilePicture || '',
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sanitizeSignupRequest = (request) => ({
  id: request._id.toString(),
  brandName: '',
  companyName: request.companyName || '',
  vendorId: request.vendorId ? request.vendorId.toString() : '',
  vendorName: request.vendorName || '',
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

// Verify account status and requested portal role

const assertUserCanAccessPortal = (user, requestedRole) => {
  if (!user || user.role !== requestedRole) {
    throw createHttpError(401, 'Invalid role or account');
  }

  if (!user.isActive) {
    throw createHttpError(403, 'This account has been deactivated');
  }
};

// Create a pending Supervisor signup request

const signup = async ({
  vendorId,
  userName,
  mobileNumber,
  email,
  role,
  password,
  panNumber,
  aadhaarNumber,
  documents,
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Defense in depth: the public signup service itself accepts Supervisors only,
  // even if validation middleware is accidentally bypassed.
  if (role !== 'supervisor') {
    throw createHttpError(
      403,
      'Public registration is available only for Supervisor accounts.'
    );
  }

  const eligibleApproverRoles =
    getApproverRolesForRequestRole(role);

  const vendorPromise = findActiveVendorById(vendorId);

  // Run independent checks and password hashing concurrently to reduce signup
  // latency without reducing bcrypt strength or validation coverage.
  const [
    existingUser,
    existingSignupRequest,
    selectedVendor,
    passwordHash,
  ] = await Promise.all([
    findUserByEmail(normalizedEmail),
    findSignupRequestByEmail(normalizedEmail),
    vendorPromise,
    bcrypt.hash(password, SALT_ROUNDS),
  ]);

  if (existingUser || existingSignupRequest) {
    throw createHttpError(
      409,
      'This email address is already registered.'
    );
  }

  if (role === 'supervisor' && !selectedVendor) {
    throw createHttpError(
      400,
      'Select an active Vendor'
    );
  }

  const identity = await createIdentityRecord({
    panNumber,
    aadhaarNumber,
    documents,
    folderKey: `signup-${normalizedEmail}`,
  });

  const SignupRequest = getSignupRequestModel();
  let request;

  try {
    request = await SignupRequest.create({
      brandName: '',
      companyName: '',
      vendorId: selectedVendor?._id || null,
      vendorName: selectedVendor?.userName || '',
      userName,
      mobileNumber,
      email: normalizedEmail,
      role,
      passwordHash,
      identity,
      eligibleApproverRoles,
      status: 'pending',
    });
  } catch (error) {
    await cleanupIdentityRecord(identity);
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

const listVendorOptions = async () => {
  const vendors = await listActiveVendors();

  return vendors.map((vendor) => ({
    id: vendor._id.toString(),
    userName: vendor.userName || 'Unnamed Vendor',
    companyName: vendor.companyName || '',
  }));
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

  return sanitizeUser(user);
};


// Update the authenticated user's own editable profile fields

const updateProfile = async (
  userId,
  {
    fullName,
    mobileNumber,
    profilePicture,
  }
) => {
  const user = await findUserById(userId);

  if (!user) {
    throw createHttpError(
      404,
      'User account no longer exists'
    );
  }

  const vendorNameChanged =
    user.role === 'vendor' &&
    user.userName !== fullName;

  user.userName = fullName;
  user.mobileNumber = mobileNumber;
  user.profilePicture = profilePicture;

  await user.save();

  if (vendorNameChanged) {
    await getUserModel().updateMany(
      {
        role: 'supervisor',
        vendorId: user._id,
      },
      {
        $set: {
          vendorName: fullName,
        },
      }
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
  listVendorOptions,
  login,
  googleLogin,
  getUserById,
  signToken,
  verifyToken,
  ensureAdminUser,
  sanitizeUser,
  buildProfileId,
  updateProfile,
};
