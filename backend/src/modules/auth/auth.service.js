const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  getUserModel,
  ensureCredentialCollection,
  findUserByEmail,
  findUserById,
} = require('./auth.model');

const {
  getSignupRequestModel,
  findPendingSignupRequestByEmail,
} = require('./signupRequest.model');

const SALT_ROUNDS = 12;

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  userName: user.userName || '',
  companyName: user.companyName || '',
  mobileNumber: user.mobileNumber || '',
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sanitizeSignupRequest = (request) => ({
  id: request._id.toString(),
  companyName: request.companyName,
  userName: request.userName,
  mobileNumber: request.mobileNumber,
  email: request.email,
  role: request.role,
  status: request.status,
  createdAt: request.createdAt,
});

const signup = async ({
  companyName,
  userName,
  mobileNumber,
  email,
  role,
  password,
}) => {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  const existingUser = await findUserByEmail(
    normalizedEmail
  );

  if (existingUser) {
    throw createHttpError(
      409,
      'An account with this email already exists'
    );
  }

  const pendingRequest =
    await findPendingSignupRequestByEmail(
      normalizedEmail
    );

  if (pendingRequest) {
    throw createHttpError(
      409,
      'A signup request with this email is already waiting for Admin approval'
    );
  }

  const SignupRequest = getSignupRequestModel();

  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  const request = await SignupRequest.create({
    companyName,
    userName,
    mobileNumber,
    email: normalizedEmail,
    role,
    passwordHash,
    status: 'pending',
  });

  return sanitizeSignupRequest(request);
};

const login = async ({
  email,
  password,
}) => {
  const user = await findUserByEmail(
    email,
    {
      includePassword: true,
    }
  );

  if (!user) {
    throw createHttpError(
      401,
      'Invalid email or password'
    );
  }

  if (!user.isActive) {
    throw createHttpError(
      403,
      'This account has been deactivated'
    );
  }

  const matches = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!matches) {
    throw createHttpError(
      401,
      'Invalid email or password'
    );
  }

  return sanitizeUser(user);
};

const getUserById = async (id) => {
  const user = await findUserById(id);

  if (!user) {
    throw createHttpError(
      401,
      'User account no longer exists'
    );
  }

  if (!user.isActive) {
    throw createHttpError(
      403,
      'This account has been deactivated'
    );
  }

  return sanitizeUser(user);
};

const signToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET is not configured'
    );
  }

  return jwt.sign(
    {
      sub: user.id,
    },
    secret,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET is not configured'
    );
  }

  return jwt.verify(
    token,
    secret
  );
};

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

const createHttpError = (
  statusCode,
  message
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

module.exports = {
  signup,
  login,
  getUserById,
  signToken,
  verifyToken,
  ensureAdminUser,
  sanitizeUser,
};