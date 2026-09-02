const mongoose = require('mongoose');
const { getUserDb } = require('../../config/db');

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    placeId: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const coldStorageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: locationSchema,
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    vendorCompanyName: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

coldStorageSchema.index(
  { vendorId: 1, normalizedName: 1 },
  { unique: true }
);

coldStorageSchema.index({ isActive: 1, vendorId: 1, name: 1 });

const MODEL_NAME = 'ColdStorage';
const COLLECTION_NAME = 'cold_storages';

const getColdStorageModel = () => {
  const db = getUserDb();

  if (db.models[MODEL_NAME]) {
    return db.models[MODEL_NAME];
  }

  return db.model(MODEL_NAME, coldStorageSchema, COLLECTION_NAME);
};

module.exports = {
  getColdStorageModel,
};
