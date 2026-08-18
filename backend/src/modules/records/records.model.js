const mongoose = require('mongoose');

/**
 * Data ownership stays in the records module for now.
 *
 * Hierarchy:
 * Brand (= collection) -> PackageDate (= document) -> LineNumber
 * (= subdocument) -> QR categories (= subdocuments) -> physical stickers.
 *
 * QR/barcode modules provide generation/rendering behavior, but they do not
 * own separate MongoDB collections yet.
 */

const geolocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const stickerSchema = new mongoose.Schema({
  barcodeId: { type: String, required: true },
});

/**
 * One QR category per requested hand count.
 * The subdocument `_id` is the unique value encoded into the QR image.
 */
const qrCodeSchema = new mongoose.Schema(
  {
    numberOfHands: {
      type: Number,
      required: true,
      enum: {
        values: [4, 5, 6, 8],
        message: '{VALUE} is not an allowed numberOfHands',
      },
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'quantity must be at least 1'],
    },
    stickers: {
      type: [stickerSchema],
      validate: {
        validator: function validateStickerCount(stickers) {
          return stickers.length === this.quantity;
        },
        message: 'stickers array length must match quantity',
      },
    },
  },
  { timestamps: true }
);

const lineSchema = new mongoose.Schema(
  {
    lineNumber: { type: Number, required: [true, 'lineNumber is required'] },
    vendorName: { type: String, required: [true, 'vendorName is required'], trim: true },
    farmerName: { type: String, required: [true, 'farmerName is required'], trim: true },
    supervisor: { type: String, required: [true, 'supervisor is required'], trim: true },
    weight: { type: Number, required: [true, 'weight is required'] },
    address: { type: String, required: [true, 'address is required'], trim: true },
    geolocation: { type: geolocationSchema, required: true },
    qrCodes: {
      type: [qrCodeSchema],
      validate: {
        validator: (items) => items.length >= 1 && items.length <= 4,
        message: 'Each line must have between 1 and 4 qrCodes entries',
      },
    },
    createdDate: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: true }
);

const packageSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true,
      enum: ['Hi Banana', 'Joker', 'Banana Man'],
    },
    packageDate: { type: Date, required: [true, 'packageDate is required'] },
    lines: { type: [lineSchema], default: [] },
  },
  { timestamps: true }
);

// Brand is represented by the collection itself, so packageDate only needs
// to be unique inside each brand collection.
packageSchema.index({ packageDate: 1 }, { unique: true });

const BRAND_COLLECTION_MAP = {
  'Hi Banana': 'hibanana',
  Joker: 'joker',
  'Banana Man': 'bananaman',
};

const ALL_BRANDS = Object.keys(BRAND_COLLECTION_MAP);

const getModelForBrand = (brandName) => {
  const collectionName = BRAND_COLLECTION_MAP[brandName];

  if (!collectionName) {
    const error = new Error(
      `Unknown brandName "${brandName}". Must be one of: ${ALL_BRANDS.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  return mongoose.model(collectionName, packageSchema, collectionName);
};

module.exports = {
  getModelForBrand,
  BRAND_COLLECTION_MAP,
  ALL_BRANDS,
};
