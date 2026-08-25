// Recovery Sheet validation dependencies

const mongoose = require('mongoose');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Reusable MongoDB ObjectId route-parameter validator

const validateObjectIdParam = (paramName, message) => (req, res, next) => {
  const value = req.params[paramName];

  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({
      success: false,
      message,
    });
  }

  return next();
};

const validateRecoverySheetId = validateObjectIdParam(
  'id',
  'Invalid Recovery Sheet ID'
);

const validateRawRecoverySheetId = validateObjectIdParam(
  'rawSheetId',
  'Invalid Raw Recovery Sheet ID'
);

// Validate Recovery Sheet lookup filters

const validateRecoveryLookupQuery = (req, res, next) => {
  const packagingDate =
    typeof req.query?.packagingDate === 'string'
      ? req.query.packagingDate.trim()
      : '';

  const vendorName =
    typeof req.query?.vendorName === 'string'
      ? req.query.vendorName.trim()
      : '';

  const rawLineNumber = req.query?.lineNumber;
  const lineNumber = Number(rawLineNumber);

  const errors = [];

  if (!DATE_RE.test(packagingDate)) {
    errors.push({
      field: 'packagingDate',
      message: 'packagingDate must use YYYY-MM-DD format',
    });
  }

  if (!vendorName) {
    errors.push({
      field: 'vendorName',
      message: 'vendorName is required',
    });
  }

  if (!Number.isInteger(lineNumber) || lineNumber < 1) {
    errors.push({
      field: 'lineNumber',
      message: 'lineNumber must be a natural number (positive integer)',
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.recoveryLookup = {
    packagingDate,
    vendorName,
    lineNumber,
  };

  return next();
};

// Export Recovery Sheet validation middleware

module.exports = {
  validateRecoverySheetId,
  validateRawRecoverySheetId,
  validateRecoveryLookupQuery,
};
