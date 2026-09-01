const mongoose = require('mongoose');

/**
 * NEW STRUCTURE (replaces the old flat one-document-per-submission model).
 *
 * Hierarchy: Brand (=collection) -> PackageDate (=document) -> LineNumber
 * (=array entry) -> 4 QR code subdocuments (one per numberOfHands value).
 *
 * One submission from the form = one LINE. Each line always gets exactly
 * 4 qrCodes entries (4/5/6/8 hands), auto-generated together.
 */

const geolocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

/**
 * One QR code entry PER HAND CATEGORY (not per sticker). `_id` (auto)
 * IS the uniqueId encoded into every sticker's QR in this category —
 * every sticker in `quantity` shares the SAME QR, per spec.
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
    // One entry per physical sticker in this category. barcodeId format:
    // "<7 random alphanumeric chars>-<numberOfHands>", unique per sticker.
    stickers: {
      type: [
        {
          barcodeId: { type: String, required: true },
        },
      ],
      validate: {
        validator: function (arr) {
          return arr.length === this.quantity;
        },
        message: 'stickers array length must match quantity',
      },
    },
  },
  { timestamps: true }
);

/**
 * One line within a package date. Holds the shared info (vendor, farmer,
 * weight, address, geolocation) ONCE, plus the 4 qrCodes.
 */
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
        validator: (arr) => arr.length >= 1 && arr.length <= 4,
        message: 'Each line must have between 1 and 4 qrCodes entries (one per requested hand category)',
      },
    },
    createdDate: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: true }
);

/**
 * Top-level document: one per Brand+PackageDate. `brandName` is kept as a
 * field (even though the collection already implies it) for readability
 * when inspecting documents directly in Compass.
 */
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

// One document per (brand-collection, packageDate). Since brand IS the
// collection, this index only needs to cover packageDate to be effectively
// unique per brand.
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
    const err = new Error(
      `Unknown brandName "${brandName}". Must be one of: ${ALL_BRANDS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
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