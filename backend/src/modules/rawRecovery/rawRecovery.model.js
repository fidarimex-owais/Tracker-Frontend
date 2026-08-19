const mongoose = require('mongoose');
const { getRawRecoveryDb } = require('../../config/db');

const ROW_COUNT = 11;
const HAND_VALUES = [4, 5, 6, 8];
const ROW_STATUSES = ['Not Started', 'In Progress', 'Completed'];

const scannedBarcodeSchema = new mongoose.Schema(
  {
    barcodeId: {
      type: String,
      required: true,
      trim: true,
    },
    handNumber: {
      type: Number,
      required: true,
      enum: HAND_VALUES,
    },
    category: {
      type: String,
      required: true,
      enum: HAND_VALUES.map((hand) => `${hand}-Hand`),
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const recoveryRowSchema = new mongoose.Schema(
  {
    rowNumber: {
      type: Number,
      required: true,
      min: 1,
      max: ROW_COUNT,
    },
    status: {
      type: String,
      required: true,
      enum: ROW_STATUSES,
      default: 'Not Started',
    },
    barcodes: {
      type: [scannedBarcodeSchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const buildInitialRows = () =>
  Array.from({ length: ROW_COUNT }, (_, index) => ({
    rowNumber: index + 1,
    status: 'Not Started',
    barcodes: [],
    startedAt: null,
    completedAt: null,
  }));

const rawRecoverySheetSchema = new mongoose.Schema(
  {
    packagingDate: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lineNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'lineNumber must be a natural number (positive integer)',
      },
      index: true,
    },
    rows: {
      type: [recoveryRowSchema],
      default: buildInitialRows,
      validate: {
        validator(rows) {
          if (!Array.isArray(rows) || rows.length !== ROW_COUNT) {
            return false;
          }

          const rowNumbers = rows.map((row) => row.rowNumber).sort((a, b) => a - b);
          return rowNumbers.every((rowNumber, index) => rowNumber === index + 1);
        },
        message: 'A Raw Recovery Sheet must contain exactly Rows 1 through 11',
      },
    },
  },
  {
    timestamps: true,
    collection: 'recovery_sheets',
  }
);

rawRecoverySheetSchema.index(
  {
    packagingDate: 1,
    vendorName: 1,
    lineNumber: 1,
  },
  {
    unique: true,
    name: 'unique_recovery_sheet',
  }
);

const MODEL_NAME = 'RawRecoverySheet';

const getRawRecoverySheetModel = () => {
  const db = getRawRecoveryDb();

  if (db.models[MODEL_NAME]) {
    return db.models[MODEL_NAME];
  }

  return db.model(
    MODEL_NAME,
    rawRecoverySheetSchema,
    'recovery_sheets'
  );
};

module.exports = {
  ROW_COUNT,
  HAND_VALUES,
  ROW_STATUSES,
  buildInitialRows,
  getRawRecoverySheetModel,
};
