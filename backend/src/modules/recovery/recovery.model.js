// Recovery Sheet model dependencies

const mongoose = require('mongoose');
const { getRecoveryDb } = require('../../config/db');

// Store calculated hand totals and recovery percentage for one row

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
    fourHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    fiveHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sixHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    eightHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    recoveryPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: false }
);

// Store a generated Recovery Sheet and its source Raw Recovery Sheet

const recoverySheetSchema = new mongoose.Schema(
  {
    rawRecoverySheetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
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
      required: true,
      validate: {
        validator(rows) {
          if (!Array.isArray(rows) || rows.length < 1) {
            return false;
          }

          const rowNumbers = rows.map((row) => row.rowNumber);

          return (
            rowNumbers.every(
              (rowNumber) => Number.isInteger(rowNumber) && rowNumber > 0
            ) && new Set(rowNumbers).size === rowNumbers.length
          );
        },
        message: 'A Recovery Sheet must contain unique positive row numbers',
      },
    },
    sourceRawUpdatedAt: {
      type: Date,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'recovery_sheets',
  }
);

// Prevent duplicate generated sheets for the same date, vendor and line

recoverySheetSchema.index(
  {
    packagingDate: 1,
    vendorName: 1,
    lineNumber: 1,
  },
  {
    unique: true,
    name: 'unique_generated_recovery_sheet',
  }
);

const MODEL_NAME = 'RecoverySheet';

// Resolve the generated Recovery Sheet model

const getRecoverySheetModel = () => {
  const db = getRecoveryDb();

  if (db.models[MODEL_NAME]) {
    return db.models[MODEL_NAME];
  }

  return db.model(
    MODEL_NAME,
    recoverySheetSchema,
    'recovery_sheets'
  );
};

// Export Recovery Sheet model helper

module.exports = {
  getRecoverySheetModel,
};
