const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');

const signupRequestSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      enum: ['Rajmata', 'Korhale', 'Jaywant'],
      required: true,
      index: true,
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
      index: true,
    },

    role: {
      type: String,
      enum: ['vendor', 'subadmin', 'supervisor'],
      required: true,
      index: true,
    },

    passwordHash: {
      type: String,
      select: false,
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
  createdAt: -1,
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
    status: 'pending',
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

const listPendingSignupRequests = async () => {
  const SignupRequest = getSignupRequestModel();

  return SignupRequest.find({
    status: 'pending',
  })
    .sort({
      createdAt: -1,
    })
    .lean();
};

const countPendingSignupRequests = async () => {
  const SignupRequest = getSignupRequestModel();

  return SignupRequest.countDocuments({
    status: 'pending',
  });
};

module.exports = {
  getSignupRequestModel,
  findPendingSignupRequestByEmail,
  findSignupRequestById,
  listPendingSignupRequests,
  countPendingSignupRequests,
};