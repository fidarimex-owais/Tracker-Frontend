const bcrypt = require('bcryptjs');

const {
  BRAND_OPTIONS,
  BRAND_ROLES,
  ALL_ROLES,
  getEffectiveBrand,
  getUserModel,
  findUserByEmail,
  findUserById,
  listUsersByRoles,
  listActivePortalUsers,
} = require('../auth/auth.model');

const {
  getSignupRequestModel,
  getRequestBrand,
  buildReviewFilterForActor,
  canActorReviewRequest,
  findPendingSignupRequestByEmail,
  findSignupRequestById,
  listPendingSignupRequestsForActor,
  countPendingSignupRequestsForActor,
} = require('../auth/signupRequest.model');

const {
  sanitizeUser,
} = require('../auth/auth.service');

const SALT_ROUNDS = 12;

const CREATABLE_ROLES_BY_ACTOR = {
  admin: ['subadmin', 'vendor', 'supervisor'],
  subadmin: ['vendor', 'supervisor'],
  vendor: ['supervisor'],
  supervisor: [],
};

const SUBADMIN_MANAGEABLE_ROLES = [
  'vendor',
  'supervisor',
];

const VENDOR_MANAGEABLE_ROLES = [
  'supervisor',
];

const sanitizePortalUser = (user) => ({
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
  brandName: getRequestBrand(request),
  userName: request.userName,
  mobileNumber: request.mobileNumber,
  email: request.email,
  role: request.role,
  status: request.status,
  createdAt: request.createdAt,
});

const getCreatableRoles = (actorRole) =>
  CREATABLE_ROLES_BY_ACTOR[actorRole] || [];

const getActorBrand = (actor) =>
  getEffectiveBrand(actor);

const requireActorBrand = (actor) => {
  const brandName = getActorBrand(actor);

  if (!BRAND_OPTIONS.includes(brandName)) {
    throw createHttpError(
      403,
      'Your Vendor account does not have a valid brand assignment'
    );
  }

  return brandName;
};

const resolveCreatedUserBrand = (
  requestedBrand,
  targetRole,
  actor
) => {
  if (!BRAND_ROLES.includes(targetRole)) {
    return '';
  }

  if (actor.role === 'vendor') {
    const actorBrand = requireActorBrand(actor);

    if (
      requestedBrand &&
      requestedBrand !== actorBrand
    ) {
      throw createHttpError(
        403,
        `Vendors can create Supervisors only for their assigned brand: ${actorBrand}`
      );
    }

    return actorBrand;
  }

  if (!BRAND_OPTIONS.includes(requestedBrand)) {
    throw createHttpError(
      400,
      'Select a valid brand for Vendor or Supervisor accounts'
    );
  }

  return requestedBrand;
};

const createUser = async (
  {
    brandName,
    userName,
    mobileNumber,
    email,
    role,
    password,
  },
  actor
) => {
  const allowedRoles = getCreatableRoles(actor.role);

  if (!allowedRoles.includes(role)) {
    throw createHttpError(
      403,
      `${formatRole(actor.role)} cannot create a ${formatRole(role)} ID`
    );
  }

  const assignedBrand = resolveCreatedUserBrand(
    brandName,
    role,
    actor
  );

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
      'This email has a pending Signup Request. Approve or reject that request first.'
    );
  }

  const User = getUserModel();
  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  const user = await User.create({
    brandName: assignedBrand,
    userName,
    mobileNumber,
    email,
    role,
    passwordHash,
    isActive: true,
    createdByAdmin: actor.role === 'admin',
  });

  return sanitizePortalUser(user);
};

const listActiveIds = async () => {
  const users = await listActivePortalUsers();
  return users.map(sanitizePortalUser);
};

const listSignupRequests = async (actor) => {
  ensureCanReviewSignupRequests(actor);

  const requests =
    await listPendingSignupRequestsForActor(actor);

  return requests.map(sanitizeSignupRequest);
};

const getSignupRequestCount = async (actor) => {
  ensureCanReviewSignupRequests(actor);

  return countPendingSignupRequestsForActor(actor);
};

const approveSignupRequest = async (
  requestId,
  actor
) => {
  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    throw createHttpError(
      403,
      'You do not have permission to approve signup requests'
    );
  }

  const SignupRequest = getSignupRequestModel();

  const claimedRequest = await SignupRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: 'pending',
      ...reviewFilter,
    },
    {
      $set: {
        status: 'processing',
      },
    },
    {
      new: true,
    }
  ).select('+passwordHash');

  if (!claimedRequest) {
    await throwRequestDecisionError(
      requestId,
      actor
    );
  }

  const requestBrand = getRequestBrand(claimedRequest);

  if (!BRAND_OPTIONS.includes(requestBrand)) {
    await restorePendingRequest(claimedRequest._id);

    throw createHttpError(
      409,
      'This signup request does not have a valid brand assignment'
    );
  }

  if (!claimedRequest.passwordHash) {
    await restorePendingRequest(claimedRequest._id);

    throw createHttpError(
      409,
      'This signup request no longer has usable credentials'
    );
  }

  const existingUser = await findUserByEmail(
    claimedRequest.email
  );

  if (existingUser) {
    await restorePendingRequest(claimedRequest._id);

    throw createHttpError(
      409,
      'An account with this email already exists'
    );
  }

  const User = getUserModel();
  let user;

  try {
    user = await User.create({
      brandName: requestBrand,
      userName: claimedRequest.userName,
      mobileNumber: claimedRequest.mobileNumber,
      email: claimedRequest.email,
      role: claimedRequest.role,
      passwordHash: claimedRequest.passwordHash,
      isActive: true,
      createdByAdmin: actor.role === 'admin',
    });
  } catch (error) {
    await restorePendingRequest(claimedRequest._id);
    throw error;
  }

  const decidedAt = new Date();
  const actorBrand =
    actor.role === 'vendor'
      ? requireActorBrand(actor)
      : '';

  const finalizedRequest = await SignupRequest.findOneAndUpdate(
    {
      _id: claimedRequest._id,
      status: 'processing',
    },
    {
      $set: {
        status: 'approved',
        reviewedBy: actor.id,
        reviewedByRole: actor.role,
        reviewedByBrand: actorBrand,
        reviewedAt: decidedAt,
        createdUserId: user._id,
      },
      $push: {
        decisions: {
          decision: 'approved',
          decidedBy: actor.id,
          decidedByRole: actor.role,
          decidedByBrand: actorBrand,
          decidedAt,
        },
      },
      $unset: {
        passwordHash: 1,
      },
    },
    {
      new: true,
    }
  );

  if (!finalizedRequest) {
    await User.deleteOne({
      _id: user._id,
    });

    throw createHttpError(
      409,
      'The signup request changed while it was being approved. Please refresh and try again.'
    );
  }

  return sanitizePortalUser(user);
};

const rejectSignupRequest = async (
  requestId,
  actor
) => {
  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    throw createHttpError(
      403,
      'You do not have permission to reject signup requests'
    );
  }

  const SignupRequest = getSignupRequestModel();
  const decidedAt = new Date();
  const actorBrand =
    actor.role === 'vendor'
      ? requireActorBrand(actor)
      : '';

  const rejectedRequest = await SignupRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: 'pending',
      ...reviewFilter,
    },
    {
      $set: {
        status: 'rejected',
        reviewedBy: actor.id,
        reviewedByRole: actor.role,
        reviewedByBrand: actorBrand,
        reviewedAt: decidedAt,
      },
      $push: {
        decisions: {
          decision: 'rejected',
          decidedBy: actor.id,
          decidedByRole: actor.role,
          decidedByBrand: actorBrand,
          decidedAt,
        },
      },
      $unset: {
        passwordHash: 1,
      },
    },
    {
      new: true,
    }
  );

  if (!rejectedRequest) {
    await throwRequestDecisionError(
      requestId,
      actor
    );
  }

  return sanitizeSignupRequest(rejectedRequest);
};

const listUsers = async (actor) => {
  let roles;
  let brandName = '';

  if (actor.role === 'admin') {
    roles = ALL_ROLES;
  } else if (actor.role === 'subadmin') {
    roles = SUBADMIN_MANAGEABLE_ROLES;
  } else if (actor.role === 'vendor') {
    roles = VENDOR_MANAGEABLE_ROLES;
    brandName = requireActorBrand(actor);
  } else {
    throw createHttpError(
      403,
      'You do not have permission to view users'
    );
  }

  const users = await listUsersByRoles(
    roles,
    {
      brandName,
    }
  );

  return users.map(sanitizeUser);
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

  const target = await findUserById(userId);

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  ensureActorCanManageTarget(actor, target);

  if (actor.role === 'subadmin') {
    if (
      !SUBADMIN_MANAGEABLE_ROLES.includes(role)
    ) {
      throw createHttpError(
        403,
        'Sub-Admins can assign only Vendor or Supervisor roles'
      );
    }
  }

  if (actor.role === 'vendor') {
    throw createHttpError(
      403,
      'Vendors cannot change user roles'
    );
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

  if (
    BRAND_ROLES.includes(role) &&
    !BRAND_OPTIONS.includes(getEffectiveBrand(target))
  ) {
    throw createHttpError(
      400,
      'Assign a valid brand before changing this user to Vendor or Supervisor'
    );
  }

  target.role = role;

  if (!BRAND_ROLES.includes(role)) {
    target.brandName = '';
  }

  await target.save();

  return sanitizeUser(target);
};

const updateBrand = async (
  userId,
  brandName,
  actor
) => {
  if (!BRAND_OPTIONS.includes(brandName)) {
    throw createHttpError(
      400,
      'Select Hi Banana, Rajmata, or Banana Man'
    );
  }

  if (!['admin', 'subadmin'].includes(actor.role)) {
    throw createHttpError(
      403,
      'Only Admin or Sub-Admin can change a user brand'
    );
  }

  const target = await findUserById(userId);

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  ensureActorCanManageTarget(actor, target);

  if (!BRAND_ROLES.includes(target.role)) {
    throw createHttpError(
      400,
      'Only Vendor and Supervisor accounts can be assigned to a brand'
    );
  }

  target.brandName = brandName;
  target.companyName = '';
  await target.save();

  return sanitizeUser(target);
};

const updateStatus = async (
  userId,
  isActive,
  actor
) => {
  if (typeof isActive !== 'boolean') {
    throw createHttpError(
      400,
      'isActive must be true or false'
    );
  }

  const target = await findUserById(userId);

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  ensureActorCanManageTarget(actor, target);

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

  return sanitizeUser(target);
};

const ensureActorCanManageTarget = (actor, target) => {
  if (actor.role === 'admin') {
    return;
  }

  if (actor.role === 'subadmin') {
    if (
      !SUBADMIN_MANAGEABLE_ROLES.includes(
        target.role
      )
    ) {
      throw createHttpError(
        403,
        'Sub-Admins can manage only Vendor and Supervisor accounts'
      );
    }

    return;
  }

  if (actor.role === 'vendor') {
    if (
      !VENDOR_MANAGEABLE_ROLES.includes(
        target.role
      )
    ) {
      throw createHttpError(
        403,
        'Vendors can manage only Supervisor accounts'
      );
    }

    const actorBrand = requireActorBrand(actor);
    const targetBrand = getEffectiveBrand(target);

    if (targetBrand !== actorBrand) {
      throw createHttpError(
        403,
        `Vendors can manage only Supervisors assigned to ${actorBrand}`
      );
    }

    return;
  }

  throw createHttpError(
    403,
    'You do not have permission to manage this user'
  );
};

const ensureCanReviewSignupRequests = (actor) => {
  if (!buildReviewFilterForActor(actor)) {
    throw createHttpError(
      403,
      'You do not have permission to review signup requests'
    );
  }
};

const restorePendingRequest = async (requestId) => {
  const SignupRequest = getSignupRequestModel();

  await SignupRequest.updateOne(
    {
      _id: requestId,
      status: 'processing',
    },
    {
      $set: {
        status: 'pending',
      },
    }
  );
};

const throwRequestDecisionError = async (
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
      'This signup request has already been decided by another authorized user'
    );
  }

  if (!canActorReviewRequest(actor, request)) {
    if (actor.role === 'vendor') {
      const actorBrand = getActorBrand(actor);

      throw createHttpError(
        403,
        `Vendors can review only Supervisor signup requests for their own brand${actorBrand ? ` (${actorBrand})` : ''}`
      );
    }

    throw createHttpError(
      403,
      `You cannot review ${formatRole(request.role)} signup requests`
    );
  }

  throw createHttpError(
    409,
    'This signup request is no longer available. Refresh and try again.'
  );
};

const formatRole = (role) => {
  if (role === 'subadmin') {
    return 'Sub-Admin';
  }

  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
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
  CREATABLE_ROLES_BY_ACTOR,
  getCreatableRoles,
  createUser,
  listActiveIds,
  listSignupRequests,
  getSignupRequestCount,
  approveSignupRequest,
  rejectSignupRequest,
  listUsers,
  updateRole,
  updateBrand,
  updateStatus,
};
