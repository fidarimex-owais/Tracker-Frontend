// Authentication model dependencies and user relationship configuration

const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');
const { identitySchema } = require('../identity/identity.schema');

const ALL_ROLES = [
  'admin',
  'subadmin',
  'vendor',
  'supervisor',
];

const MODEL_NAME = 'UserCredential';
const COLLECTION_NAME = 'credentials';

// User credential schema

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

    // Legacy fields. New Vendor/Supervisor accounts never use a brand.
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

    // Supervisors are linked directly to a Vendor account.
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // Denormalized display name keeps common reads fast. It is refreshed when
    // the Vendor changes their own full name.
    vendorName: {
      type: String,
      trim: true,
      default: '',
    },

    mobileNumber: {
      type: String,
      trim: true,
      default: '',
    },

    profilePicture: {
      type: String,
      trim: true,
      default: '',
    },

    role: {
      type: String,
      enum: ALL_ROLES,
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


    // PAN, Aadhaar and uploaded identity documents are deliberately excluded
    // from normal queries. Only the Admin identity endpoints opt in with
    // .select('+identity').
    identity: {
      type: identitySchema,
      select: false,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Relationship-aware read indexes keep Vendor dropdowns and Supervisor lists
// efficient as the credential collection grows.
userSchema.index({ role: 1, isActive: 1, userName: 1 });
userSchema.index({ vendorId: 1, role: 1, createdAt: -1 });

// Never persist a brand relationship for Vendor or Supervisor credentials.
// Vendors also cannot themselves point at another Vendor.
userSchema.pre('validate', function normalizeAccountRelationship() {
  if (['vendor', 'supervisor'].includes(this.role)) {
    this.brandName = '';
    this.companyName = '';
  }

  if (this.role !== 'supervisor') {
    this.vendorId = null;
    this.vendorName = '';
  }
});

// Initialize and access the credential collection

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

  // One-time-safe migration: Vendor/Supervisor credentials must no longer carry
  // a brand association. Existing Supervisors are left unassigned to a Vendor
  // because inferring a Vendor from an old shared brand would be ambiguous.
  await Promise.all([
    User.updateMany(
      {
        role: {
          $in: ['vendor', 'supervisor'],
        },
        $or: [
          { brandName: { $nin: ['', null] } },
          { companyName: { $nin: ['', null] } },
        ],
      },
      {
        $set: {
          brandName: '',
          companyName: '',
        },
      }
    ),
    User.updateMany(
      {
        role: 'vendor',
        $or: [
          { vendorId: { $ne: null } },
          { vendorName: { $nin: ['', null] } },
        ],
      },
      {
        $set: {
          vendorId: null,
          vendorName: '',
        },
      }
    ),
  ]);
};

// Find users by normalized email or MongoDB ID

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
  {
    includePassword = false,
    includeIdentity = false,
  } = {}
) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const User = getUserModel();
  const query = User.findById(id);

  if (includePassword) {
    query.select('+passwordHash');
  }

  if (includeIdentity) {
    query.select('+identity');
  }

  return query;
};

const findActiveVendorById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  return getUserModel()
    .findOne({
      _id: id,
      role: 'vendor',
      isActive: true,
    })
    .select('_id userName email isActive role')
    .lean();
};

const listActiveVendors = async () =>
  getUserModel()
    .find({
      role: 'vendor',
      isActive: true,
    })
    .select('_id userName email')
    .sort({
      userName: 1,
      createdAt: 1,
    })
    .lean();

// List portal users according to role and optional Vendor ownership.

const listUsersByRoles = async (
  roles = ALL_ROLES,
  { vendorId = '' } = {}
) => {
  const User = getUserModel();
  const validRoles = roles.filter((role) =>
    ALL_ROLES.includes(role)
  );

  const filter = {
    role: {
      $in: validRoles,
    },
  };

  if (mongoose.isValidObjectId(vendorId)) {
    filter.vendorId = vendorId;
  }

  return User.find(filter)
    .select('-profilePicture -passwordHash')
    .sort({
      createdAt: -1,
    })
    .lean();
};

const listActivePortalUsers = async () => {
  const User = getUserModel();

  return User.find({
    isActive: true,
    role: {
      $in: ['subadmin', 'vendor', 'supervisor'],
    },
  })
    .select('-profilePicture -passwordHash')
    .sort({
      createdAt: -1,
    })
    .lean();
};

// Export authentication model helpers

module.exports = {
  ALL_ROLES,
  getUserModel,
  ensureCredentialCollection,
  findUserByEmail,
  findUserById,
  findActiveVendorById,
  listActiveVendors,
  listUsersByRoles,
  listActivePortalUsers,
};
