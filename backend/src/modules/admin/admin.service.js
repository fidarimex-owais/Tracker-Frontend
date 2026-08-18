const bcrypt = require('bcryptjs');

const {
  ALL_ROLES,
  getUserModel,
  findUserByEmail,
  findUserById,
  listUsersByRoles,
  listAdminCreatedActiveUsers,
} = require('../auth/auth.model');

const {
  findPendingSignupRequestByEmail,
  findSignupRequestById,
  getSignupRequestModel,
  listPendingSignupRequests,
  countPendingSignupRequests,
} = require('../auth/signupRequest.model');

const {
  sanitizeUser,
} = require('../auth/auth.service');

const SALT_ROUNDS = 12;

const SUBADMIN_MANAGEABLE_ROLES = [
  'vendor',
  'supervisor',
];

const ADMIN_CREATABLE_ROLES = [
  'vendor',
  'subadmin',
  'supervisor',
];

const sanitizePortalUser = (user) => ({
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

const createUser = async ({
  companyName,
  userName,
  mobileNumber,
  email,
  role,
  password,
}) => {
  if (!ADMIN_CREATABLE_ROLES.includes(role)) {
    throw createHttpError(
      400,
      'Admin can create only Vendor, Sub-Admin, or Supervisor IDs'
    );
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    throw createHttpError(
      409,
      'An account with this email already exists'
    );
  }

  const pendingRequest =
    await findPendingSignupRequestByEmail(email);

  if (pendingRequest) {
    throw createHttpError(
      409,
      'This email has a pending Signup Request. Approve or reject it from Signup Requests.'
    );
  }

  const User = getUserModel();

  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  const user = await User.create({
    companyName,
    userName,
    mobileNumber,
    email,
    role,
    passwordHash,
    isActive: true,
    createdByAdmin: true,
  });

  return sanitizePortalUser(user);
};

const listActiveIds = async () => {
  const users = await listAdminCreatedActiveUsers();

  return users.map(sanitizePortalUser);
};

const listSignupRequests = async () => {
  const requests = await listPendingSignupRequests();

  return requests.map(sanitizeSignupRequest);
};

const getSignupRequestCount = async () =>
  countPendingSignupRequests();

const approveSignupRequest = async (
  requestId,
  actor
) => {
  const request = await findSignupRequestById(
    requestId,
    {
      includePassword: true,
    }
  );

  if (!request) {
    throw createHttpError(
      404,
      'Signup request not found'
    );
  }

  if (request.status !== 'pending') {
    throw createHttpError(
      409,
      'This signup request has already been reviewed'
    );
  }

  if (!request.passwordHash) {
    throw createHttpError(
      409,
      'This signup request no longer has usable credentials'
    );
  }

  const existingUser = await findUserByEmail(
    request.email
  );

  if (existingUser) {
    throw createHttpError(
      409,
      'An account with this email already exists'
    );
  }

  const User = getUserModel();

  const user = await User.create({
    companyName: request.companyName,
    userName: request.userName,
    mobileNumber: request.mobileNumber,
    email: request.email,
    role: request.role,
    passwordHash: request.passwordHash,
    isActive: true,
    createdByAdmin: true,
  });

  const SignupRequest = getSignupRequestModel();

  await SignupRequest.updateOne(
    {
      _id: request._id,
      status: 'pending',
    },
    {
      $set: {
        status: 'approved',
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        createdUserId: user._id,
      },
      $unset: {
        passwordHash: 1,
      },
    }
  );

  return sanitizePortalUser(user);
};

const rejectSignupRequest = async (
  requestId,
  actor
) => {
  const request = await findSignupRequestById(
    requestId
  );

  if (!request) {
    throw createHttpError(
      404,
      'Signup request not found'
    );
  }

  if (request.status !== 'pending') {
    throw createHttpError(
      409,
      'This signup request has already been reviewed'
    );
  }

  const SignupRequest = getSignupRequestModel();

  await SignupRequest.updateOne(
    {
      _id: request._id,
      status: 'pending',
    },
    {
      $set: {
        status: 'rejected',
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      },
      $unset: {
        passwordHash: 1,
      },
    }
  );

  return {
    ...sanitizeSignupRequest(request),
    status: 'rejected',
  };
};

const listUsers = async (actor) => {
  const roles =
    actor.role === 'subadmin'
      ? SUBADMIN_MANAGEABLE_ROLES
      : ALL_ROLES;

  const users = await listUsersByRoles(
    roles
  );

  return users.map(
    sanitizeUser
  );
};

const updateRole = async (
  userId,
  role,
  actor
) => {
  if (!ALL_ROLES.includes(role)) {
    throw createHttpError(
      400,
      'role must be admin, subadmin, vendor, or supervisor'
    );
  }

  const target = await findUserById(
    userId
  );

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  if (actor.role === 'subadmin') {
    if (
      !SUBADMIN_MANAGEABLE_ROLES.includes(
        target.role
      )
    ) {
      throw createHttpError(
        403,
        'Sub-Admins cannot modify Admin or Sub-Admin accounts'
      );
    }

    if (
      !SUBADMIN_MANAGEABLE_ROLES.includes(
        role
      )
    ) {
      throw createHttpError(
        403,
        'Sub-Admins can assign only Vendor or Supervisor roles'
      );
    }
  }

  if (
    userId === actor.id &&
    actor.role === 'admin' &&
    role !== 'admin'
  ) {
    throw createHttpError(
      400,
      'You cannot remove your own admin role'
    );
  }

  target.role = role;

  await target.save();

  return sanitizeUser(
    target
  );
};

const updateStatus = async (
  userId,
  isActive,
  actor
) => {
  if (
    typeof isActive !== 'boolean'
  ) {
    throw createHttpError(
      400,
      'isActive must be true or false'
    );
  }

  const target = await findUserById(
    userId
  );

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  if (
    actor.role === 'subadmin' &&
    !SUBADMIN_MANAGEABLE_ROLES.includes(
      target.role
    )
  ) {
    throw createHttpError(
      403,
      'Sub-Admins cannot modify Admin or Sub-Admin accounts'
    );
  }

  if (
    userId === actor.id &&
    isActive === false
  ) {
    throw createHttpError(
      400,
      'You cannot deactivate your own account'
    );
  }

  target.isActive = isActive;

  await target.save();

  return sanitizeUser(
    target
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
  createUser,
  listActiveIds,
  listSignupRequests,
  getSignupRequestCount,
  approveSignupRequest,
  rejectSignupRequest,
  listUsers,
  updateRole,
  updateStatus,
};