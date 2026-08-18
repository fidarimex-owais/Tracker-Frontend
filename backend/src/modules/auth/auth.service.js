const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./auth.model');

const SALT_ROUNDS = 12;

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signup = async ({ email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw createHttpError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, passwordHash, role: 'vendor' });
  return sanitizeUser(user);
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw createHttpError(401, 'Invalid email or password');
  if (!user.isActive) throw createHttpError(403, 'This account has been deactivated');

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw createHttpError(401, 'Invalid email or password');

  return sanitizeUser(user);
};

const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw createHttpError(401, 'User account no longer exists');
  if (!user.isActive) throw createHttpError(403, 'This account has been deactivated');
  return sanitizeUser(user);
};

const signToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user.id }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.verify(token, secret);
};

const ensureAdminUser = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const existing = await User.findOne({ email }).select('+passwordHash');
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
    if (changed) await existing.save();
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await User.create({ email, passwordHash, role: 'admin', isActive: true });
  console.log(`Bootstrap admin created: ${email}`);
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { signup, login, getUserById, signToken, verifyToken, ensureAdminUser, sanitizeUser };
