const User = require('../auth/auth.model');
const { sanitizeUser } = require('../auth/auth.service');

const ALL_ROLES = ['admin', 'subadmin', 'vendor', 'supervisor'];
const SUBADMIN_MANAGEABLE_ROLES = ['vendor', 'supervisor'];

const listUsers = async (actor) => {
  const query = actor.role === 'subadmin'
    ? { role: { $in: SUBADMIN_MANAGEABLE_ROLES } }
    : {};

  const users = await User.find(query).sort({ createdAt: -1 });
  return users.map(sanitizeUser);
};

const updateRole = async (userId, role, actor) => {
  if (!ALL_ROLES.includes(role)) {
    throw createHttpError(400, 'role must be admin, subadmin, vendor, or supervisor');
  }

  const target = await User.findById(userId);
  if (!target) throw createHttpError(404, 'User not found');

  if (actor.role === 'subadmin') {
    if (!SUBADMIN_MANAGEABLE_ROLES.includes(target.role)) {
      throw createHttpError(403, 'Sub-Admins cannot modify Admin or Sub-Admin accounts');
    }
    if (!SUBADMIN_MANAGEABLE_ROLES.includes(role)) {
      throw createHttpError(403, 'Sub-Admins can assign only Vendor or Supervisor roles');
    }
  }

  if (userId === actor.id && actor.role === 'admin' && role !== 'admin') {
    throw createHttpError(400, 'You cannot remove your own admin role');
  }

  target.role = role;
  await target.save();
  return sanitizeUser(target);
};

const updateStatus = async (userId, isActive, actor) => {
  if (typeof isActive !== 'boolean') {
    throw createHttpError(400, 'isActive must be true or false');
  }

  const target = await User.findById(userId);
  if (!target) throw createHttpError(404, 'User not found');

  if (actor.role === 'subadmin' && !SUBADMIN_MANAGEABLE_ROLES.includes(target.role)) {
    throw createHttpError(403, 'Sub-Admins cannot modify Admin or Sub-Admin accounts');
  }

  if (userId === actor.id && isActive === false) {
    throw createHttpError(400, 'You cannot deactivate your own account');
  }

  target.isActive = isActive;
  await target.save();
  return sanitizeUser(target);
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { listUsers, updateRole, updateStatus };
