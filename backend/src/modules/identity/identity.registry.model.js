const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');

const MODEL_NAME = 'IdentityRegistry';
const COLLECTION_NAME = 'identity_registry';

const identityRegistrySchema = new mongoose.Schema(
  {
    // Only keyed HMAC lookup values are stored here. Raw PAN/Aadhaar values
    // never leave the encrypted identity payload.
    panHash: {
      type: String,
      required: true,
    },
    aadhaarHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

identityRegistrySchema.index(
  { panHash: 1 },
  {
    unique: true,
    name: 'unique_pan_identity_hash',
  }
);

identityRegistrySchema.index(
  { aadhaarHash: 1 },
  {
    unique: true,
    name: 'unique_aadhaar_identity_hash',
  }
);

const getIdentityRegistryModel = () => {
  const userDb = getUserDb();

  if (userDb.models[MODEL_NAME]) {
    return userDb.models[MODEL_NAME];
  }

  return userDb.model(
    MODEL_NAME,
    identityRegistrySchema,
    COLLECTION_NAME
  );
};

let indexesReadyPromise = null;

const ensureIdentityRegistryIndexes = async () => {
  if (!indexesReadyPromise) {
    const IdentityRegistry = getIdentityRegistryModel();
    indexesReadyPromise = IdentityRegistry.createIndexes().catch((error) => {
      indexesReadyPromise = null;
      throw error;
    });
  }

  await indexesReadyPromise;
};

module.exports = {
  getIdentityRegistryModel,
  ensureIdentityRegistryIndexes,
};
