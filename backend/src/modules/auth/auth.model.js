const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');

const BRAND_OPTIONS = [
  'Hi Banana',
  'Joker',
  'Banana Man',
];

const BRAND_ROLES = [
  'vendor',
  'supervisor',
];

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

    brandName: {
      type: String,
      enum: ['', ...BRAND_OPTIONS],
      default: '',
      index: true,
    },

    // Legacy field kept so older credential documents can still be read.
    // New code uses brandName only.
    companyName: {
      type: String,
      trim: true,
      default: '',
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

userSchema.pre('validate', function enforceBrandAssignment() {
  if (BRAND_ROLES.includes(this.role)) {
    if (
      !this.brandName &&
      BRAND_OPTIONS.includes(this.companyName)
    ) {
      this.brandName = this.companyName;
    }

    if (!BRAND_OPTIONS.includes(this.brandName)) {
      this.invalidate(
        'brandName',
        'Vendor and Supervisor accounts must have a valid brand'
      );
    }
  }
});

const MODEL_NAME = 'UserCredential';
const COLLECTION_NAME = 'credentials';

const ALL_ROLES = [
  'admin',
  'subadmin',
  'vendor',
  'supervisor',
];

const getEffectiveBrand = (user) => {
  if (!user) {
    return '';
  }

  if (BRAND_OPTIONS.includes(user.brandName)) {
    return user.brandName;
  }

  if (BRAND_OPTIONS.includes(user.companyName)) {
    return user.companyName;
  }

  return '';
};

const buildBrandFilter = (brandName) => ({
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
  roles = ALL_ROLES,
  { brandName = '' } = {}
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

  if (BRAND_OPTIONS.includes(brandName)) {
    Object.assign(
      filter,
      buildBrandFilter(brandName)
    );
  }

  return User.find(filter)
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
    .sort({
      createdAt: -1,
    })
    .lean();
};

module.exports = {
  BRAND_OPTIONS,
  BRAND_ROLES,
  ALL_ROLES,
  getEffectiveBrand,
  buildBrandFilter,
  getUserModel,
  ensureCredentialCollection,
  findUserByEmail,
  findUserById,
  listUsersByRoles,
  listActivePortalUsers,
};
