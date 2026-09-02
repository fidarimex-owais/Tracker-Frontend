// Barcode model dependencies and supported hand values

const mongoose = require('mongoose');
const { getBarcodeDb } = require('../../config/db');

const HAND_VALUES = [4, 5, 6, 8];

// Embedded geolocation data for each generated line

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
  { _id: false }
);

// Barcode category data grouped by hand quantity

const barcodeCategorySchema = new mongoose.Schema(
  {
    numberOfHands: {
      type: Number,
      required: true,
      enum: HAND_VALUES,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    qrUniqueId: {
      type: String,
      required: true,
    },
    barcodes: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

// Generated barcode data for one packaging line

const barcodeLineSchema = new mongoose.Schema(
  {
    lineNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'lineNumber must be a natural number (positive integer)',
      },
    },

    // Copy of the same user-entered QR-generation data.
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    vendorId: {
      type: String,
      trim: true,
      default: '',
    },
    coldStorageId: {
      type: String,
      trim: true,
      default: '',
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
      required: true,
      trim: true,
    },
    supervisor: {
      type: String,
      required: true,
      trim: true,
    },
    weight: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    geolocation: {
      type: geolocationSchema,
      required: true,
    },
    quantities: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Generated QR/barcode data copied from qr_brand_details.
    barcodeData: {
      type: [barcodeCategorySchema],
      default: [],
    },

    source: {
      qrDatabase: {
        type: String,
        default: 'qr_brand_details',
      },
      qrCollection: {
        type: String,
        required: true,
      },
      qrPackageId: {
        type: String,
        required: true,
      },
      qrLineId: {
        type: String,
        required: true,
      },
    },

    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Store all generated lines for one vendor and packaging date

const vendorBarcodeSchema = new mongoose.Schema(
  {
    packageDate: {
      type: String,
      required: true,
      immutable: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    lines: {
      type: [barcodeLineSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Convert the packaging date into its MongoDB collection name

const formatPackageDateCollectionName = (packageDate) => {
  const date = packageDate instanceof Date
    ? packageDate
    : new Date(packageDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid packageDate for barcode collection');
  }

  return date.toISOString().slice(0, 10);
};

// Resolve the date-specific barcode collection model

const getBarcodeModelForPackageDate = (packageDate) => {
  const collectionName = formatPackageDateCollectionName(packageDate);
  const modelName = `BarcodePackage_${collectionName.replace(/-/g, '_')}`;
  const barcodeDb = getBarcodeDb();

  if (barcodeDb.models[modelName]) {
    return barcodeDb.models[modelName];
  }

  return barcodeDb.model(
    modelName,
    vendorBarcodeSchema,
    collectionName
  );
};

// Export barcode model helpers

module.exports = {
  HAND_VALUES,
  formatPackageDateCollectionName,
  getBarcodeModelForPackageDate,
};
