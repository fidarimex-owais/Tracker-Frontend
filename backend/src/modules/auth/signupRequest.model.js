// Signup request model dependencies and role configuration

const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');
const {
  BRAND_OPTIONS,
  getEffectiveBrand,
} = require('./auth.model');

const PUBLIC_SIGNUP_ROLES = [
  'vendor',
  'supervisor',
];

const APPROVER_ROLES_BY_REQUEST_ROLE = {
  vendor: ['admin', 'subadmin'],
  supervisor: ['admin', 'subadmin', 'vendor'],
};

const REQUEST_ROLES_BY_APPROVER = {
  admin: ['vendor', 'supervisor'],
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

    decidedByBrand: {
      type: String,
      enum: ['', ...BRAND_OPTIONS],
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
    brandName: {
      type: String,
      enum: BRAND_OPTIONS,
      required: true,
      index: true,
    },

    // Legacy field retained only for reading older pending requests.
    companyName: {
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

    reviewedByBrand: {
      type: String,
      enum: ['', ...BRAND_OPTIONS],
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
  brandName: 1,
  createdAt: -1,
});

const MODEL_NAME = 'SignupRequest';
const COLLECTION_NAME = 'signup_requests';

// Initialize and access the signup request collection

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

// Resolve signup review permissions by role

const getApproverRolesForRequestRole = (role) =>
  APPROVER_ROLES_BY_REQUEST_ROLE[role] || [];

const getRequestRolesForApprover = (actorRole) =>
  REQUEST_ROLES_BY_APPROVER[actorRole] || [];

const getRequestBrand = (request) => {
  if (!request) {
    return '';
  }

  if (BRAND_OPTIONS.includes(request.brandName)) {
    return request.brandName;
  }

  if (BRAND_OPTIONS.includes(request.companyName)) {
    return request.companyName;
  }

  return '';
};

const buildRequestBrandFilter = (brandName) => ({
  $or: [
    {
      brandName,
    },
    {
      brandName: {
        $in: ['', null],
      },
      companyName: brandName,
    },
  ],
});

// Build the database filter for requests the current actor may review

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
    const actorBrand = getEffectiveBrand(actor);

    if (!BRAND_OPTIONS.includes(actorBrand)) {
      return null;
    }

    Object.assign(
      filter,
      buildRequestBrandFilter(actorBrand)
    );
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

  const actorBrand = getEffectiveBrand(actor);
  const requestBrand = getRequestBrand(request);

  return (
    BRAND_OPTIONS.includes(actorBrand) &&
    actorBrand === requestBrand
  );
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
  { includePassword = false } = {}
) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const SignupRequest = getSignupRequestModel();
  const query = SignupRequest.findById(id);

  if (includePassword) {
    query.select('+passwordHash');
  }

  return query;
};

// List and count pending requests visible to the current actor

const listPendingSignupRequestsForActor = async (actor) => {
  const reviewFilter = buildReviewFilterForActor(actor);

  if (!reviewFilter) {
    return [];
  }

  const SignupRequest = getSignupRequestModel();

  return SignupRequest.find({
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

  const SignupRequest = getSignupRequestModel();

  return SignupRequest.countDocuments({
    status: 'pending',
    ...reviewFilter,
  });
};

// Export signup request model helpers

module.exports = {
  PUBLIC_SIGNUP_ROLES,
  APPROVER_ROLES_BY_REQUEST_ROLE,
  REQUEST_ROLES_BY_APPROVER,
  getSignupRequestModel,
  getApproverRolesForRequestRole,
  getRequestRolesForApprover,
  getRequestBrand,
  buildReviewFilterForActor,
  canActorReviewRequest,
  findSignupRequestByEmail,
  findPendingSignupRequestByEmail,
  findSignupRequestById,
  listPendingSignupRequestsForActor,
  countPendingSignupRequestsForActor,
};
