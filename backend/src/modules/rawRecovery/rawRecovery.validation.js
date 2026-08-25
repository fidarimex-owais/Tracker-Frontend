// Raw Recovery request validation helpers

const mongoose = require('mongoose');

// Accept and normalize supported packaging-date formats

const normalizePackagingDate = (value) => {
  const raw = String(value || '').trim();

  let year;
  let month;
  let day;

  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    [, year, month, day] = match;
  } else {
    match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);

    if (!match) {
      return null;
    }

    [, day, month, year] = match;
  }

  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }

  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// Parse positive integer values used for lines and rows

const parseNaturalNumber = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

// Validate data required to create a Raw Recovery Sheet

const validateCreateSheet = (req, res, next) => {
  const packagingDate = normalizePackagingDate(req.body?.packagingDate);
  const vendorName = String(req.body?.vendorName || '').trim();
  const lineNumber = parseNaturalNumber(req.body?.lineNumber);
  const errors = [];

  if (!packagingDate) {
    errors.push({
      field: 'packagingDate',
      message: 'packagingDate must be a valid YYYY-MM-DD or DD-MM-YYYY date',
    });
  }

  if (!vendorName) {
    errors.push({
      field: 'vendorName',
      message: 'vendorName is required',
    });
  }

  if (!lineNumber) {
    errors.push({
      field: 'lineNumber',
      message: 'lineNumber must be a natural number (1, 2, 3, ...)',
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = {
    packagingDate,
    vendorName,
    lineNumber,
  };

  return next();
};

// Validate Raw Recovery Sheet MongoDB IDs

const validateSheetId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Recovery Sheet ID',
    });
  }

  return next();
};

// Validate row numbers from route parameters

const validateRowNumber = (req, res, next) => {
  const rowNumber = parseNaturalNumber(req.params.rowNumber);

  if (!rowNumber) {
    return res.status(400).json({
      success: false,
      message: 'rowNumber must be a natural number (1, 2, 3, ...)',
    });
  }

  req.rowNumber = rowNumber;
  return next();
};

// Validate barcode format and derive its hand category

const validateBarcodeScan = (req, res, next) => {
  const barcodeId = String(req.body?.barcodeId || '').trim();

  if (!barcodeId) {
    return res.status(400).json({
      success: false,
      message: 'barcodeId is required',
      errors: [
        {
          field: 'barcodeId',
          message: 'barcodeId is required',
        },
      ],
    });
  }

  const match = barcodeId.match(/-(4|5|6|8)$/);

  if (!match) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported barcode category',
      errors: [
        {
          field: 'barcodeId',
          message: 'Barcode must end with -4, -5, -6, or -8',
        },
      ],
    });
  }

  const handNumber = Number(match[1]);

  req.barcodeScan = {
    barcodeId,
    handNumber,
    category: `${handNumber}-Hand`,
  };

  return next();
};

// Validate sheet lookup filters

const validateLookupQuery = (req, res, next) => {
  const packagingDate = normalizePackagingDate(req.query?.packagingDate);
  const vendorName = String(req.query?.vendorName || '').trim();
  const lineNumber = parseNaturalNumber(req.query?.lineNumber);

  if (!packagingDate || !vendorName || !lineNumber) {
    return res.status(400).json({
      success: false,
      message: 'packagingDate, vendorName, and lineNumber are required',
    });
  }

  req.lookup = {
    packagingDate,
    vendorName,
    lineNumber,
  };

  return next();
};

// Validate packaging date queries

const validatePackagingDateQuery = (req, res, next) => {
  const packagingDate = normalizePackagingDate(req.query?.packagingDate);

  if (!packagingDate) {
    return res.status(400).json({
      success: false,
      message: 'A valid packagingDate is required',
    });
  }

  req.packagingDate = packagingDate;
  return next();
};

// Validate vendor and packaging-date line queries

const validateLinesQuery = (req, res, next) => {
  const packagingDate = normalizePackagingDate(req.query?.packagingDate);
  const vendorName = String(req.query?.vendorName || '').trim();

  if (!packagingDate || !vendorName) {
    return res.status(400).json({
      success: false,
      message: 'packagingDate and vendorName are required',
    });
  }

  req.vendorLookup = {
    packagingDate,
    vendorName,
  };

  return next();
};

// Export Raw Recovery validation middleware

module.exports = {
  normalizePackagingDate,
  validateCreateSheet,
  validateSheetId,
  validateRowNumber,
  validateBarcodeScan,
  validateLookupQuery,
  validatePackagingDateQuery,
  validateLinesQuery,
};
