const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    userName: {
      type: String,
      trim: true,
      default: '',
    },

    companyName: {
      type: String,
      enum: ['', 'Rajmata', 'Korhale', 'Jaywant'],
      default: '',
      index: true,
    },

    mobileNumber: {
      type: String,
      trim: true,
      default: '',
    },

    role: {
      type: String,
      enum: ['admin', 'subadmin', 'vendor', 'supervisor'],
      required: true,
      default: 'vendor',
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdByAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const MODEL_NAME = 'UserCredential';
const COLLECTION_NAME = 'credentials';

const ALL_ROLES = [
  'admin',
  'subadmin',
  'vendor',
  'supervisor',
];

const getUserModel = () => {
  const userDb = getUserDb();

  if (userDb.models[MODEL_NAME]) {
    return userDb.models[MODEL_NAME];
  }

  return userDb.model(
    MODEL_NAME,
    userSchema,
    COLLECTION_NAME
  );
};

const ensureCredentialCollection = async () => {
  const User = getUserModel();

  await User.createCollection();
  await User.syncIndexes();
};

const findUserByEmail = async (
  email,
  { includePassword = false } = {}
) => {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const User = getUserModel();

  const query = User.findOne({
    email: normalizedEmail,
  });

  if (includePassword) {
    query.select('+passwordHash');
  }

  return query;
};

const findUserById = async (
  id,
  { includePassword = false } = {}
) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const User = getUserModel();

  const query = User.findById(id);

  if (includePassword) {
    query.select('+passwordHash');
  }

  return query;
};

const listUsersByRoles = async (
  roles = ALL_ROLES
) => {
  const User = getUserModel();

  const validRoles = roles.filter((role) =>
    ALL_ROLES.includes(role)
  );

  return User.find({
    role: {
      $in: validRoles,
    },
  })
    .sort({
      createdAt: -1,
    })
    .lean();
};

const listAdminCreatedActiveUsers = async () => {
  const User = getUserModel();

  return User.find({
    createdByAdmin: true,
    isActive: true,
    role: {
      $in: ['vendor', 'subadmin', 'supervisor'],
    },
  })
    .sort({
      createdAt: -1,
    })
    .lean();
};

module.exports = {
  ALL_ROLES,
  getUserModel,
  ensureCredentialCollection,
  findUserByEmail,
  findUserById,
  listUsersByRoles,
  listAdminCreatedActiveUsers,
};