// Signup request model dependencies and role configuration

const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');
const { identitySchema } = require('../identity/identity.schema');

const PUBLIC_SIGNUP_ROLES = [
  'subadmin',
  'vendor',
  'supervisor',
];

const APPROVER_ROLES_BY_REQUEST_ROLE = {
  subadmin: ['admin'],
  vendor: ['admin', 'subadmin'],
  supervisor: ['admin', 'subadmin', 'vendor'],
};

const REQUEST_ROLES_BY_APPROVER = {
  admin: ['subadmin', 'vendor', 'supervisor'],
  subadmin: ['vendor', 'supervisor'],
  vendor: ['supervisor'],
  supervisor: [],
};

// Store the approval or rejection history for a signup request

const decisionSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ['approved', 'rejected'],
      required: true,
    },

    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    decidedByRole: {
      type: String,
      enum: ['admin', 'subadmin', 'vendor'],
      required: true,
    },

    // Legacy field retained for older decision history only.
    decidedByBrand: {
      type: String,
      default: '',
    },

    decidedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

// Pending signup request schema

const signupRequestSchema = new mongoose.Schema(
  {
    // Legacy fields retained for reading older pending requests. New requests do
    // not associate Vendor or Supervisor accounts with brands.
    brandName: {
      type: String,
      trim: true,
      default: '',
    },

    companyName: {
      type: String,
      trim: true,
      default: '',
    },

    // Supervisor requests point directly to the selected Vendor.
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    vendorName: {
      type: String,
      trim: true,
      default: '',
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },

    role: {
      type: String,
      enum: PUBLIC_SIGNUP_ROLES,
      required: true,
      index: true,
    },

    passwordHash: {
      type: String,
      select: false,
    },


    // Sensitive registration identity data is hidden from all ordinary signup
    // request queries. Only Admin-only endpoints explicitly select it.
    identity: {
      type: identitySchema,
      select: false,
      default: undefined,
    },

    eligibleApproverRoles: {
      type: [String],
      enum: ['admin', 'subadmin', 'vendor'],
      default: [],
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },

    decisions: {
      type: [decisionSchema],
      default: [],
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    reviewedByRole: {
      type: String,
      enum: ['admin', 'subadmin', 'vendor'],
      default: null,
    },

    // Legacy field retained for older review history only.
    reviewedByBrand: {
      type: String,
      default: '',
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    createdUserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

signupRequestSchema.index({
  status: 1,
  role: 1,
  vendorId: 1,
  createdAt: -1,
});

signupRequestSchema.pre('validate', function normalizeSignupRelationship() {
  this.brandName = '';

  // companyName belongs only to Vendor signup requests and is not a Brand.
  if (this.role !== 'vendor') {
    this.companyName = '';
  }

  if (this.role !== 'supervisor') {
    this.vendorId = null;
    this.vendorName = '';
  }
});

const MODEL_NAME = 'SignupRequest';
const COLLECTION_NAME = 'signup_requests';

const getSignupRequestModel = () => {
  const userDb = getUserDb();

  if (userDb.models[MODEL_NAME]) {
    return userDb.models[MODEL_NAME];
  }

  return userDb.model(
    MODEL_NAME,
    signupRequestSchema,
    COLLECTION_NAME
  );
};

const getApproverRolesForRequestRole = (role) =>
  APPROVER_ROLES_BY_REQUEST_ROLE[role] || [];

const getRequestRolesForApprover = (actorRole) =>
  REQUEST_ROLES_BY_APPROVER[actorRole] || [];

const getRequestVendorId = (request) => {
  const value = request?.vendorId;
  return value ? value.toString() : '';
};

const buildReviewFilterForActor = (actor) => {
  const requestRoles = getRequestRolesForApprover(
    actor?.role
  );

  if (requestRoles.length === 0) {
    return null;
  }

  const filter = {
    role: {
      $in: requestRoles,
    },
  };

  if (actor.role === 'vendor') {
    filter.vendorId = actor.id;
  }

  return filter;
};

const canActorReviewRequest = (actor, request) => {
  const requestRoles = getRequestRolesForApprover(
    actor?.role
  );

  if (!requestRoles.includes(request?.role)) {
    return false;
  }

  if (actor.role !== 'vendor') {
    return true;
  }

  return getRequestVendorId(request) === actor.id;
};

// Signup request lookup helpers

const findSignupRequestByEmail = async (email) => {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const SignupRequest = getSignupRequestModel();

  return SignupRequest.findOne({
    email: normalizedEmail,
  }).sort({
    createdAt: -1,
  });
};

const findPendingSignupRequestByEmail = async (email) => {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const SignupRequest = getSignupRequestModel();

  return SignupRequest.findOne({
    email: normalizedEmail,
    status: {
      $in: ['pending', 'processing'],
    },
  });
};

const findSignupRequestById = async (
  id,
  {
    includePassword = false,
    includeIdentity = false,
  } = {}
) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const SignupRequest = getSignupRequestModel();
  const query = SignupRequest.findById(id);

  if (includePassword) {
    query.select('+passwordHash');
  }

  if (includeIdentity) {
    query.select('+identity');
  }

  return query;
};

const listPendingSignupRequestsForActor = async (actor) => {
  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    return [];
  }

  return getSignupRequestModel()
    .find({
      status: 'pending',
      ...reviewFilter,
    })
    .sort({
      createdAt: -1,
    })
    .lean();
};

const countPendingSignupRequestsForActor = async (actor) => {
  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    return 0;
  }

  return getSignupRequestModel().countDocuments({
    status: 'pending',
    ...reviewFilter,
  });
};

module.exports = {
  PUBLIC_SIGNUP_ROLES,
  APPROVER_ROLES_BY_REQUEST_ROLE,
  REQUEST_ROLES_BY_APPROVER,
  getSignupRequestModel,
  getApproverRolesForRequestRole,
  getRequestRolesForApprover,
  getRequestVendorId,
  buildReviewFilterForActor,
  canActorReviewRequest,
  findSignupRequestByEmail,
  findPendingSignupRequestByEmail,
  findSignupRequestById,
  listPendingSignupRequestsForActor,
  countPendingSignupRequestsForActor,
};
