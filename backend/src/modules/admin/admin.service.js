// Admin service dependencies and related data models

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const {
  ALL_ROLES,
  getUserModel,
  findUserByEmail,
  findUserById,
  findActiveVendorById,
  listActiveVendors,
  listUsersByRoles,
  listActivePortalUsers,
} = require('../auth/auth.model');

const {
  getSignupRequestModel,
  getRequestVendorId,
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
  createIdentityRecord,
  prepareIdentityUpdate,
  revealIdentityForAdmin,
  buildPrivateDocumentUrl,
  cleanupDocuments,
  cleanupIdentityRecord,
  rollbackIdentityRegistryUpdate,
} = require('../identity/identity.service');

const {
  getModelForBrand,
  ALL_BRANDS,
} = require('../records/records.model');

const {
  getRecoverySheetModel,
} = require('../recovery/recovery.model');

const {
  MAX_DOCUMENTS,
} = require('../identity/identity.validation');


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
  brandName: '',
  companyName: user.companyName || '',
  vendorId: user.vendorId ? user.vendorId.toString() : '',
  vendorName: user.vendorName || '',
  mobileNumber: user.mobileNumber || '',
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sanitizeSignupRequest = (request) => ({
  id: request._id.toString(),
  brandName: '',
  companyName: request.companyName || '',
  vendorId: getRequestVendorId(request),
  vendorName: request.vendorName || '',
  userName: request.userName,
  mobileNumber: request.mobileNumber,
  email: request.email,
  role: request.role,
  status: request.status,
  createdAt: request.createdAt,
});

const getCreatableRoles = (actorRole) =>
  CREATABLE_ROLES_BY_ACTOR[actorRole] || [];

const resolveCreatedUserVendor = async (
  requestedVendorId,
  targetRole,
  actor
) => {
  if (targetRole !== 'supervisor') {
    return null;
  }

  if (actor.role === 'vendor') {
    return {
      _id: actor.id,
      userName: actor.userName || 'Vendor',
    };
  }

  const vendor = await findActiveVendorById(
    requestedVendorId
  );

  if (!vendor) {
    throw createHttpError(
      400,
      'Select an active Vendor for the Supervisor'
    );
  }

  return vendor;
};

const listVendorOptions = async () => {
  const vendors = await listActiveVendors();

  return vendors.map((vendor) => ({
    id: vendor._id.toString(),
    userName: vendor.userName || 'Unnamed Vendor',
    companyName: vendor.companyName || '',
    email: vendor.email,
  }));
};

// Create portal users according to the current actor's permissions

const createUser = async (
  {
    vendorId,
    companyName,
    userName,
    mobileNumber,
    email,
    role,
    password,
    panNumber,
    aadhaarNumber,
    documents,
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

  const vendorPromise = resolveCreatedUserVendor(
    vendorId,
    role,
    actor
  );

  // These operations are independent, so running them together shortens the
  // create-ID path without reducing bcrypt rounds or validation checks.
  const [
    assignedVendor,
    existing,
    existingSignupRequest,
    passwordHash,
  ] = await Promise.all([
    vendorPromise,
    findUserByEmail(email),
    findSignupRequestByEmail(email),
    bcrypt.hash(password, SALT_ROUNDS),
  ]);

  if (existing || existingSignupRequest) {
    throw createHttpError(
      409,
      'This email address is already registered.'
    );
  }

  const identity = await createIdentityRecord({
    panNumber,
    aadhaarNumber,
    documents,
    folderKey: `created-${email}`,
  });

  const User = getUserModel();
  let user;

  try {
    user = await User.create({
      brandName: '',
      companyName: role === 'vendor' ? companyName : '',
      vendorId: assignedVendor?._id || null,
      vendorName: assignedVendor?.userName || '',
      userName,
      mobileNumber,
      email,
      role,
      passwordHash,
      identity,
      isActive: true,
      createdByAdmin: actor.role === 'admin',
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
  actor,
  requestedVendorId = ''
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
  ).select('+passwordHash +identity');

  if (!claimedRequest) {
    await throwRequestDecisionError(
      requestId,
      actor
    );
  }

  if (!claimedRequest.passwordHash) {
    await restorePendingRequest(claimedRequest._id);

    throw createHttpError(
      409,
      'This signup request no longer has usable credentials'
    );
  }

  if (!claimedRequest.identity) {
    await restorePendingRequest(claimedRequest._id);

    throw createHttpError(
      409,
      'Identity data for this signup request was deleted. Reject the request and ask the user to register again.'
    );
  }

  let assignedVendor = null;

  if (claimedRequest.role === 'supervisor') {
    const candidateVendorId =
      actor.role === 'vendor'
        ? actor.id
        : requestedVendorId || getRequestVendorId(claimedRequest);

    assignedVendor = await findActiveVendorById(
      candidateVendorId
    );

    if (!assignedVendor) {
      await restorePendingRequest(claimedRequest._id);

      throw createHttpError(
        400,
        'Select an active Vendor before approving this Supervisor request'
      );
    }

    if (
      actor.role === 'vendor' &&
      assignedVendor._id.toString() !== actor.id
    ) {
      await restorePendingRequest(claimedRequest._id);

      throw createHttpError(
        403,
        'Vendors can approve only Supervisor requests assigned to them'
      );
    }
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
      brandName: '',
      companyName:
        claimedRequest.role === 'vendor'
          ? claimedRequest.companyName || ''
          : '',
      vendorId: assignedVendor?._id || null,
      vendorName: assignedVendor?.userName || '',
      userName: claimedRequest.userName,
      mobileNumber: claimedRequest.mobileNumber,
      email: claimedRequest.email,
      role: claimedRequest.role,
      passwordHash: claimedRequest.passwordHash,
      identity:
        claimedRequest.identity?.toObject?.() ||
        claimedRequest.identity ||
        undefined,
      isActive: true,
      createdByAdmin: actor.role === 'admin',
    });
  } catch (error) {
    await restorePendingRequest(claimedRequest._id);
    throw error;
  }

  const decidedAt = new Date();

  const finalizedRequest = await SignupRequest.findOneAndUpdate(
    {
      _id: claimedRequest._id,
      status: 'processing',
    },
    {
      $set: {
        status: 'approved',
        vendorId: assignedVendor?._id || null,
        vendorName: assignedVendor?.userName || '',
        brandName: '',
        companyName:
          claimedRequest.role === 'vendor'
            ? claimedRequest.companyName || ''
            : '',
        reviewedBy: actor.id,
        reviewedByRole: actor.role,
        reviewedByBrand: '',
        reviewedAt: decidedAt,
        createdUserId: user._id,
      },
      $push: {
        decisions: {
          decision: 'approved',
          decidedBy: actor.id,
          decidedByRole: actor.role,
          decidedByBrand: '',
          decidedAt,
        },
      },
      $unset: {
        passwordHash: 1,
        identity: 1,
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
        reviewedByBrand: '',
        reviewedAt: decidedAt,
      },
      $push: {
        decisions: {
          decision: 'rejected',
          decidedBy: actor.id,
          decidedByRole: actor.role,
          decidedByBrand: '',
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
  ).select('+identity');

  if (!rejectedRequest) {
    await throwRequestDecisionError(
      requestId,
      actor
    );
  }

  await cleanupIdentityRecord(rejectedRequest.identity);

  await SignupRequest.updateOne(
    { _id: rejectedRequest._id },
    { $unset: { identity: 1 } }
  );

  return sanitizeSignupRequest(rejectedRequest);
};

// User listing and account-management operations

const listUsers = async (actor) => {
  let roles;
  let vendorId = '';

  if (actor.role === 'admin') {
    roles = ALL_ROLES;
  } else if (actor.role === 'subadmin') {
    roles = SUBADMIN_MANAGEABLE_ROLES;
  } else if (actor.role === 'vendor') {
    roles = VENDOR_MANAGEABLE_ROLES;
    vendorId = actor.id;
  } else {
    throw createHttpError(
      403,
      'You do not have permission to view users'
    );
  }

  const users = await listUsersByRoles(
    roles,
    {
      vendorId,
    }
  );

  return users.map(sanitizePortalUser);
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

  if (
    actor.role === 'subadmin' &&
    !SUBADMIN_MANAGEABLE_ROLES.includes(role)
  ) {
    throw createHttpError(
      403,
      'Sub-Admins can assign only Vendor or Supervisor roles'
    );
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

  target.role = role;
  target.brandName = '';

  if (role !== 'vendor') {
    target.companyName = '';
  }

  if (role !== 'supervisor') {
    target.vendorId = null;
    target.vendorName = '';
  }

  await target.save();

  return sanitizePortalUser(target);
};

const updateVendor = async (
  userId,
  vendorId,
  actor
) => {
  if (!['admin', 'subadmin'].includes(actor.role)) {
    throw createHttpError(
      403,
      'Only Admin or Sub-Admin can change a Supervisor Vendor'
    );
  }

  const [target, vendor] = await Promise.all([
    findUserById(userId),
    findActiveVendorById(vendorId),
  ]);

  if (!target) {
    throw createHttpError(
      404,
      'User not found'
    );
  }

  if (!vendor) {
    throw createHttpError(
      400,
      'Select an active Vendor'
    );
  }

  ensureActorCanManageTarget(actor, target);

  if (target.role !== 'supervisor') {
    throw createHttpError(
      400,
      'Only Supervisor accounts can be assigned to a Vendor'
    );
  }

  target.vendorId = vendor._id;
  target.vendorName = vendor.userName || 'Vendor';
  target.brandName = '';
  target.companyName = '';
  await target.save();

  return sanitizePortalUser(target);
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
  const target = await findUserById(userId, {
    includeIdentity: true,
  });

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

  if (
    actor.role === 'vendor' &&
    target.vendorId?.toString() !== actor.id
  ) {
    throw createHttpError(
      403,
      'Vendors can delete only Supervisors assigned to them'
    );
  }

  const deletedUser = sanitizeUser(target);
  const identity = target.identity;

  await target.deleteOne();
  await cleanupIdentityRecord(identity);

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

    if (target.vendorId?.toString() !== actor.id) {
      throw createHttpError(
        403,
        'Vendors can manage only Supervisors assigned to them'
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
      throw createHttpError(
        403,
        'Vendors can review only Supervisor signup requests assigned to them'
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
    brandName: '',
    vendorId: getRequestVendorId(request),
    vendorName: request.vendorName || '',
    role: request.role,
    email: request.email,
    status: request.status,
    createdAt: request.createdAt,
  }));
};

const buildVendorSummary = (users) => {
  const vendors = users.filter(
    (user) => user.role === 'vendor'
  );

  const summary = vendors.map((vendor) => ({
    vendorId: vendor._id.toString(),
    vendorName: vendor.userName || vendor.email,
    supervisors: 0,
  }));

  const index = new Map(
    summary.map((item) => [item.vendorId, item])
  );

  let unassignedSupervisors = 0;

  for (const user of users) {
    if (user.role !== 'supervisor') {
      continue;
    }

    const vendorId = user.vendorId?.toString() || '';
    const vendor = index.get(vendorId);

    if (vendor) {
      vendor.supervisors += 1;
    } else {
      unassignedSupervisors += 1;
    }
  }

  if (unassignedSupervisors > 0) {
    summary.push({
      vendorId: 'unassigned',
      vendorName: 'Unassigned',
      supervisors: unassignedSupervisors,
    });
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
    vendorSummary: buildVendorSummary(activeUsers),
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
    vendorSummary: buildVendorSummary(activeUsers),
    signupTrend,
    recentSignupRequests,
  };
};

const getVendorDashboardOverview = async (actor) => {
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
        vendorId: actor.id,
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
    vendorName: actor.userName || 'Vendor',
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
      brandName: '',
      vendorId: actor.vendorId ? actor.vendorId.toString() : '',
      vendorName: actor.vendorName || '',
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


// Admin-only identity and document access

const serializeIdentitySubmission = (
  record,
  source,
  status
) => {
  const identity = revealIdentityForAdmin(record.identity);

  if (!identity) {
    return null;
  }

  return {
    id: record._id.toString(),
    source,
    status,
    userName: record.userName || '',
    mobileNumber: record.mobileNumber || '',
    email: record.email,
    role: record.role,
    companyName: record.companyName || '',
    vendorName: record.vendorName || '',
    createdAt: record.createdAt,
    ...identity,
  };
};

const listIdentitySubmissions = async () => {
  const User = getUserModel();
  const SignupRequest = getSignupRequestModel();

  const [users, pendingRequests] = await Promise.all([
    User.find({
      role: { $in: ['subadmin', 'vendor', 'supervisor'] },
      identity: { $exists: true },
    })
      .select('+identity')
      .sort({ createdAt: -1 })
      .lean(),
    SignupRequest.find({
      role: { $in: ['subadmin', 'vendor', 'supervisor'] },
      status: { $in: ['pending', 'processing'] },
      identity: { $exists: true },
    })
      .select('+identity')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return [
    ...pendingRequests
      .map((request) =>
        serializeIdentitySubmission(
          request,
          'signup-request',
          request.status
        )
      )
      .filter(Boolean),
    ...users
      .map((user) =>
        serializeIdentitySubmission(
          user,
          'user',
          user.isActive ? 'active' : 'inactive'
        )
      )
      .filter(Boolean),
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() -
      new Date(left.createdAt).getTime()
  );
};

const getIdentityRecordForAdmin = async (
  source,
  recordId,
  { requireEditable = false } = {}
) => {
  if (!mongoose.isValidObjectId(recordId)) {
    throw createHttpError(400, 'Invalid identity record reference');
  }

  let record;

  if (source === 'user') {
    record = await getUserModel()
      .findById(recordId)
      .select('+identity');
  } else if (source === 'signup-request') {
    record = await getSignupRequestModel()
      .findById(recordId)
      .select('+identity');
  } else {
    throw createHttpError(400, 'Invalid identity record source');
  }

  if (!record?.identity) {
    throw createHttpError(404, 'Identity record not found');
  }

  if (
    requireEditable &&
    source === 'signup-request' &&
    record.status !== 'pending'
  ) {
    throw createHttpError(
      409,
      'This signup request is currently being processed and cannot be edited'
    );
  }

  return record;
};

const identityStatusForRecord = (record, source) =>
  source === 'user'
    ? record.isActive
      ? 'active'
      : 'inactive'
    : record.status;

const updateIdentitySubmission = async (
  source,
  recordId,
  {
    panNumber,
    aadhaarNumber,
    companyName,
    documents = [],
  }
) => {
  const record = await getIdentityRecordForAdmin(
    source,
    recordId,
    { requireEditable: true }
  );

  const existingDocumentCount =
    record.identity.documents?.length || 0;

  if (
    existingDocumentCount + documents.length >
    MAX_DOCUMENTS
  ) {
    throw createHttpError(
      400,
      `A maximum of ${MAX_DOCUMENTS} documents can be stored for one user`
    );
  }

  if (
    record.role === 'vendor' &&
    (companyName.length < 2 || companyName.length > 120)
  ) {
    throw createHttpError(
      400,
      'Enter the Vendor company name (2 to 120 characters)'
    );
  }

  const prepared = await prepareIdentityUpdate({
    panNumber,
    aadhaarNumber,
    documents,
    folderKey: `admin-edit-${source}-${record.email}`,
    currentRegistryId: record.identity.registryId || null,
    excludeSource: source,
    excludeRecordId: record._id.toString(),
  });

  try {
    record.identity.registryId = prepared.registryId;
    record.identity.panEncrypted = prepared.panEncrypted;
    record.identity.aadhaarEncrypted =
      prepared.aadhaarEncrypted;
    record.identity.panVerification =
      prepared.panVerification;
    record.identity.aadhaarVerification =
      prepared.aadhaarVerification;
    record.identity.verifiedAt = prepared.verifiedAt;

    prepared.uploadedDocuments.forEach((document) => {
      record.identity.documents.push(document);
    });

    if (record.role === 'vendor') {
      record.companyName = companyName;
    }

    await record.save();
  } catch (error) {
    await Promise.all([
      cleanupDocuments(prepared.uploadedDocuments),
      rollbackIdentityRegistryUpdate(prepared.registryRollback),
    ]);
    throw error;
  }

  return serializeIdentitySubmission(
    record,
    source,
    identityStatusForRecord(record, source)
  );
};

const deleteIdentityDocument = async (
  source,
  recordId,
  documentId
) => {
  if (!mongoose.isValidObjectId(documentId)) {
    throw createHttpError(400, 'Invalid document reference');
  }

  const record = await getIdentityRecordForAdmin(
    source,
    recordId,
    { requireEditable: true }
  );
  const document = record.identity.documents.id(documentId);

  if (!document) {
    throw createHttpError(404, 'Document not found');
  }

  const storedDocument =
    document.toObject?.() || { ...document };

  record.identity.documents.pull(documentId);
  await record.save();
  await cleanupDocuments([storedDocument]);

  return serializeIdentitySubmission(
    record,
    source,
    identityStatusForRecord(record, source)
  );
};

const deleteIdentitySubmission = async (
  source,
  recordId
) => {
  const record = await getIdentityRecordForAdmin(
    source,
    recordId,
    { requireEditable: true }
  );

  const identity =
    record.identity?.toObject?.() || record.identity;

  if (source === 'signup-request') {
    await record.deleteOne();
  } else {
    record.set('identity', undefined);
    await record.save();
  }

  await cleanupIdentityRecord(identity);

  return {
    id: record._id.toString(),
    source,
    signupRequestDeleted: source === 'signup-request',
  };
};

const getIdentityDocumentAccess = async (
  source,
  recordId,
  documentId
) => {
  if (
    !mongoose.isValidObjectId(recordId) ||
    !mongoose.isValidObjectId(documentId)
  ) {
    throw createHttpError(400, 'Invalid document reference');
  }

  const record = await getIdentityRecordForAdmin(
    source,
    recordId
  );

  const document = record.identity.documents.id(documentId);

  if (!document) {
    throw createHttpError(404, 'Document not found');
  }

  return buildPrivateDocumentUrl(document);
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
  listVendorOptions,
  createUser,
  listActiveIds,
  listSignupRequests,
  getSignupRequestCount,
  approveSignupRequest,
  rejectSignupRequest,
  listUsers,
  updateRole,
  updateVendor,
  updateStatus,
  deleteUser,
  listIdentitySubmissions,
  updateIdentitySubmission,
  deleteIdentitySubmission,
  deleteIdentityDocument,
  getIdentityDocumentAccess,
};
