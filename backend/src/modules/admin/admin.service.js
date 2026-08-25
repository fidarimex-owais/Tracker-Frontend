// Admin service dependencies and related data models

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
  findSignupRequestByEmail,
  findSignupRequestById,
  listPendingSignupRequestsForActor,
  countPendingSignupRequestsForActor,
} = require('../auth/signupRequest.model');

const {
  sanitizeUser,
} = require('../auth/auth.service');

const {
  getModelForBrand,
  ALL_BRANDS,
} = require('../records/records.model');

const {
  getRecoverySheetModel,
} = require('../recovery/recovery.model');

// Account creation and role-permission configuration

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


const DELETABLE_ROLES_BY_ACTOR = {
  admin: ['subadmin', 'vendor', 'supervisor'],
  subadmin: ['vendor', 'supervisor'],
  vendor: ['supervisor'],
  supervisor: [],
};

// Convert database records into safe API response objects

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

// Create portal users according to the current actor's permissions

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

  const [existing, existingSignupRequest] = await Promise.all([
    findUserByEmail(email),
    findSignupRequestByEmail(email),
  ]);

  if (existing || existingSignupRequest) {
    throw createHttpError(
      409,
      'This email address is already registered.'
    );
  }

  const User = getUserModel();
  const passwordHash = await bcrypt.hash(
    password,
    SALT_ROUNDS
  );

  let user;

  try {
    user = await User.create({
      brandName: assignedBrand,
      userName,
      mobileNumber,
      email,
      role,
      passwordHash,
      isActive: true,
      createdByAdmin: actor.role === 'admin',
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

// Approve or reject pending signup requests

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
      'This email address is already registered.'
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

// User listing and account-management operations

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
      'Select Hi Banana, Joker, or Banana Man'
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


// Permanently delete users when permitted by the role hierarchy

const deleteUser = async (
  userId,
  actor
) => {
  const target = await findUserById(userId);

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  const allowedRoles =
    DELETABLE_ROLES_BY_ACTOR[actor.role] || [];

  if (!allowedRoles.includes(target.role)) {
    throw createHttpError(
      403,
      `${formatRole(actor.role)} cannot delete a ${formatRole(target.role)} account`
    );
  }

  if (target._id.toString() === actor.id) {
    throw createHttpError(
      400,
      'You cannot delete your own account'
    );
  }

  if (actor.role === 'vendor') {
    const actorBrand = requireActorBrand(actor);
    const targetBrand = getEffectiveBrand(target);

    if (targetBrand !== actorBrand) {
      throw createHttpError(
        403,
        `Vendors can delete only Supervisors assigned to ${actorBrand}`
      );
    }
  }

  const deletedUser = sanitizeUser(target);
  await target.deleteOne();

  return deletedUser;
};

// Shared authorization checks for user-management actions

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

// Dashboard statistics and reporting helpers

const countGeneratedQrRecords = async () => {
  const totals = await Promise.all(
    ALL_BRANDS.map(async (brandName) => {
      const Model = getModelForBrand(brandName);
      const result = await Model.aggregate([
        {
          $unwind: '$lines',
        },
        {
          $unwind: '$lines.qrCodes',
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ['$lines.qrCodes.quantity', 0],
              },
            },
          },
        },
      ]);

      return Number(result[0]?.total || 0);
    })
  );

  return totals.reduce((sum, total) => sum + total, 0);
};

const buildSignupTrendForActor = async (actor) => {
  const SignupRequest = getSignupRequestModel();
  const startDate = new Date();

  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - 6);

  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    return buildEmptySevenDayTrend(startDate);
  }

  const aggregated = await SignupRequest.aggregate([
    {
      $match: {
        ...reviewFilter,
        createdAt: {
          $gte: startDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'UTC',
          },
        },
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  const counts = new Map(
    aggregated.map((item) => [item._id, item.count])
  );

  return buildSevenDayTrend(startDate, counts);
};

const buildEmptySevenDayTrend = (startDate) =>
  buildSevenDayTrend(startDate, new Map());

const buildSevenDayTrend = (startDate, counts) => {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;

    return {
      date: key,
      label: `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}`,
      count: Number(counts.get(key) || 0),
    };
  });
};

const getRecentSignupRequestsForActor = async (
  actor,
  limit = 5
) => {
  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    return [];
  }

  const requests = await getSignupRequestModel()
    .find(reviewFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return requests.map((request) => ({
    id: request._id.toString(),
    userName: request.userName,
    brandName: getRequestBrand(request),
    role: request.role,
    email: request.email,
    status: request.status,
    createdAt: request.createdAt,
  }));
};

const buildBrandSummary = (users) => {
  const summary = BRAND_OPTIONS.map((brandName) => ({
    brandName,
    vendors: 0,
    supervisors: 0,
    totalUsers: 0,
  }));

  const index = new Map(
    summary.map((item) => [item.brandName, item])
  );

  for (const user of users) {
    const brandName = getEffectiveBrand(user);
    const brand = index.get(brandName);

    if (!brand) {
      continue;
    }

    if (user.role === 'vendor') {
      brand.vendors += 1;
    }

    if (user.role === 'supervisor') {
      brand.supervisors += 1;
    }

    brand.totalUsers = brand.vendors + brand.supervisors;
  }

  return summary;
};

// Build role-specific dashboard summaries

const getAdminDashboardOverview = async (actor) => {
  const [
    activeUsers,
    pendingSignupRequests,
    qrRecords,
    recoverySheets,
    recentSignupRequests,
    signupTrend,
  ] = await Promise.all([
    listActivePortalUsers(),
    countPendingSignupRequestsForActor(actor),
    countGeneratedQrRecords(),
    getRecoverySheetModel().countDocuments({}),
    getRecentSignupRequestsForActor(actor),
    buildSignupTrendForActor(actor),
  ]);

  const userSummary = {
    subadmins: 0,
    vendors: 0,
    supervisors: 0,
  };

  for (const user of activeUsers) {
    if (user.role === 'subadmin') {
      userSummary.subadmins += 1;
    } else if (user.role === 'vendor') {
      userSummary.vendors += 1;
    } else if (user.role === 'supervisor') {
      userSummary.supervisors += 1;
    }
  }

  return {
    role: 'admin',
    summary: {
      totalUsers: activeUsers.length,
      pendingSignupRequests,
      qrRecords,
      recoverySheets,
    },
    userSummary,
    brandSummary: buildBrandSummary(activeUsers),
    signupTrend,
    recentSignupRequests,
  };
};

const getSubAdminDashboardOverview = async (actor) => {
  const [
    manageableUsers,
    pendingSignupRequests,
    qrRecords,
    recoverySheets,
    recentSignupRequests,
    signupTrend,
  ] = await Promise.all([
    listUsersByRoles(['vendor', 'supervisor']),
    countPendingSignupRequestsForActor(actor),
    countGeneratedQrRecords(),
    getRecoverySheetModel().countDocuments({}),
    getRecentSignupRequestsForActor(actor),
    buildSignupTrendForActor(actor),
  ]);

  const activeUsers = manageableUsers.filter(
    (user) => user.isActive
  );

  const userSummary = {
    vendors: activeUsers.filter(
      (user) => user.role === 'vendor'
    ).length,
    supervisors: activeUsers.filter(
      (user) => user.role === 'supervisor'
    ).length,
  };

  return {
    role: 'subadmin',
    summary: {
      managedUsers: activeUsers.length,
      pendingSignupRequests,
      qrRecords,
      recoverySheets,
    },
    userSummary,
    brandSummary: buildBrandSummary(activeUsers),
    signupTrend,
    recentSignupRequests,
  };
};

const getVendorDashboardOverview = async (actor) => {
  const brandName = requireActorBrand(actor);

  const [
    supervisors,
    pendingSignupRequests,
    recoverySheets,
    recentSignupRequests,
    signupTrend,
  ] = await Promise.all([
    listUsersByRoles(
      ['supervisor'],
      {
        brandName,
      }
    ),
    countPendingSignupRequestsForActor(actor),
    getRecoverySheetModel().countDocuments({}),
    getRecentSignupRequestsForActor(actor),
    buildSignupTrendForActor(actor),
  ]);

  const activeSupervisors = supervisors.filter(
    (user) => user.isActive
  );

  return {
    role: 'vendor',
    brandName,
    summary: {
      totalSupervisors: supervisors.length,
      activeSupervisors: activeSupervisors.length,
      pendingSignupRequests,
      recoverySheets,
    },
    supervisorSummary: {
      total: supervisors.length,
      active: activeSupervisors.length,
      inactive: supervisors.length - activeSupervisors.length,
    },
    signupTrend,
    recentSignupRequests,
    recentSupervisors: supervisors
      .slice(0, 5)
      .map(sanitizePortalUser),
  };
};

const getSupervisorDashboardOverview = async (actor) => {
  const RecoverySheet = getRecoverySheetModel();

  const [
    recoverySheets,
    recentRecoverySheets,
  ] = await Promise.all([
    RecoverySheet.countDocuments({}),
    RecoverySheet.find({})
      .select({
        packagingDate: 1,
        vendorName: 1,
        lineNumber: 1,
        generatedAt: 1,
      })
      .sort({
        generatedAt: -1,
      })
      .limit(6)
      .lean(),
  ]);

  return {
    role: 'supervisor',
    profile: {
      userName: actor.userName || '',
      email: actor.email,
      brandName: getEffectiveBrand(actor),
      isActive: actor.isActive,
      role: actor.role,
    },
    summary: {
      recoverySheets,
    },
    recentRecoverySheets: recentRecoverySheets.map(
      (sheet) => ({
        id: sheet._id.toString(),
        packagingDate: sheet.packagingDate,
        vendorName: sheet.vendorName,
        lineNumber: sheet.lineNumber,
        generatedAt: sheet.generatedAt,
      })
    ),
  };
};

// Return the appropriate dashboard data for the signed-in role

const getDashboardOverview = async (actor) => {
  if (actor.role === 'admin') {
    return getAdminDashboardOverview(actor);
  }

  if (actor.role === 'subadmin') {
    return getSubAdminDashboardOverview(actor);
  }

  if (actor.role === 'vendor') {
    return getVendorDashboardOverview(actor);
  }

  if (actor.role === 'supervisor') {
    return getSupervisorDashboardOverview(actor);
  }

  throw createHttpError(
    403,
    'Dashboard access is not available for this role'
  );
};

// General service helpers

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

// Export Admin service functions

module.exports = {
  CREATABLE_ROLES_BY_ACTOR,
  getCreatableRoles,
  getDashboardOverview,
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
  deleteUser,
};
