const mongoose = require('mongoose');
const { getRawRecoveryDb } = require('../../config/db');

const DEFAULT_ROW_COUNT = 11;
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
      validate: {
        validator: Number.isInteger,
        message: 'rowNumber must be a natural number (positive integer)',
      },
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

const buildInitialRows = (count = DEFAULT_ROW_COUNT) =>
  Array.from({ length: count }, (_, index) => ({
    rowNumber: index + 1,
    status: 'Not Started',
    barcodes: [],
    startedAt: null,
    completedAt: null,
  }));

const rowsAreValid = (rows) => {
  if (!Array.isArray(rows) || rows.length < 1) {
    return false;
  }

  const numbers = rows.map((row) => row.rowNumber);

  if (
    numbers.some(
      (rowNumber) => !Number.isInteger(rowNumber) || rowNumber < 1
    )
  ) {
    return false;
  }

  return new Set(numbers).size === numbers.length;
};

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
      default: () => buildInitialRows(),
      validate: {
        validator: rowsAreValid,
        message: 'A Raw Recovery Sheet must contain unique positive row numbers',
      },
    },
    savedAt: {
      type: Date,
      default: null,
      index: true,
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
  DEFAULT_ROW_COUNT,
  HAND_VALUES,
  ROW_STATUSES,
  buildInitialRows,
  getRawRecoverySheetModel,
};
