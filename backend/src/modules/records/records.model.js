// QR brand record model dependencies

const mongoose = require('mongoose');
const { getBrandDb } = require('../../config/db');

/**
 * QR/brand data lives in:
 *
 * qr_brand_details
 * ├── hi_banana
 * ├── banana_man
 * └── joker
 */

// Store latitude and longitude for each QR record line

const geolocationSchema = new mongoose.Schema(
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
  },
  {
    _id: false,
  }
);

// Store the generated barcode ID for an individual sticker

const stickerSchema = new mongoose.Schema({
  barcodeId: {
    type: String,
    required: true,
  },
});

// Define hand category quantities and their generated stickers

const qrCodeSchema = new mongoose.Schema(
  {
    numberOfHands: {
      type: Number,
      required: true,

      enum: {
        values: [4, 5, 6, 8],
        message:
          '{VALUE} is not an allowed numberOfHands',
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
        validator: function validateStickerCount(
          stickers
        ) {
          return (
            stickers.length === this.quantity
          );
        },

        message:
          'stickers array length must match quantity',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Store vendor, farmer, supervisor and QR data for one line

const lineSchema = new mongoose.Schema(
  {
    lineNumber: {
      type: Number,
      required: [
        true,
        'lineNumber is required',
      ],
    },

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    vendorName: {
      type: String,
      required: [
        true,
        'vendorName is required',
      ],
      trim: true,
    },

    coldStorageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    coldStorageName: {
      type: String,
      trim: true,
      default: '',
    },

    coldStorageAddress: {
      type: String,
      trim: true,
      default: '',
    },

    coldStorageLocation: {
      type: geolocationSchema,
      default: undefined,
    },

    farmPlotAddress: {
      type: String,
      trim: true,
      default: '',
    },

    farmPlotLocation: {
      type: geolocationSchema,
      default: undefined,
    },

    distanceMeters: {
      type: Number,
      min: 0,
      default: null,
    },

    distanceKm: {
      type: Number,
      min: 0,
      default: null,
    },

    routeDurationSeconds: {
      type: Number,
      min: 0,
      default: null,
    },

    farmerName: {
      type: String,
      required: [
        true,
        'farmerName is required',
      ],
      trim: true,
    },

    supervisor: {
      type: String,
      required: [
        true,
        'supervisor is required',
      ],
      trim: true,
    },

    weight: {
      type: Number,
      required: [
        true,
        'weight is required',
      ],
    },

    address: {
      type: String,
      required: [
        true,
        'address is required',
      ],
      trim: true,
    },

    geolocation: {
      type: geolocationSchema,
      required: true,
    },

    qrCodes: {
      type: [qrCodeSchema],

      validate: {
        validator: (items) =>
          items.length >= 1 &&
          items.length <= 4,

        message:
          'Each line must have between 1 and 4 qrCodes entries',
      },
    },

    createdDate: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

// Store all lines for a brand on a packaging date

const packageSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true,

      enum: [
        'Hi Banana',
        'Joker',
        'Banana Man',
      ],
    },

    packageDate: {
      type: Date,
      required: [
        true,
        'packageDate is required',
      ],
    },

    lines: {
      type: [lineSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

packageSchema.index(
  {
    packageDate: 1,
  },
  {
    unique: true,
  }
);

// Map each supported brand to its MongoDB collection

const BRAND_COLLECTION_MAP = {
  'Hi Banana': {
    modelName: 'HiBananaPackage',
    collectionName: 'hi_banana',
  },

  'Banana Man': {
    modelName: 'BananaManPackage',
    collectionName: 'banana_man',
  },

  Joker: {
    modelName: 'JokerPackage',
    collectionName: 'joker',
  },
};

const ALL_BRANDS =
  Object.keys(BRAND_COLLECTION_MAP);

// Resolve the correct Mongoose model for the selected brand

const getModelForBrand = (
  brandName
) => {
  const config =
    BRAND_COLLECTION_MAP[brandName];

  if (!config) {
    const error = new Error(
      `Unknown brandName "${brandName}". ` +
        `Must be one of: ${ALL_BRANDS.join(
          ', '
        )}`
    );

    error.statusCode = 400;

    throw error;
  }

  const brandDb = getBrandDb();

  if (
    brandDb.models[config.modelName]
  ) {
    return brandDb.models[
      config.modelName
    ];
  }

  return brandDb.model(
    config.modelName,
    packageSchema,
    config.collectionName
  );
};

// Export brand model helpers and supported brands

module.exports = {
  getModelForBrand,
  BRAND_COLLECTION_MAP,
  ALL_BRANDS,
};