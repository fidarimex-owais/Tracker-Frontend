const {
  getRawRecoverySheetModel,
  buildInitialRows,
} = require('./rawRecovery.model');
const {
  getBarcodeModelForPackageDate,
} = require('../barcode/barcode.model');

const createSheet = async ({ packagingDate, vendorName, lineNumber }) => {
  const RawRecoverySheet = getRawRecoverySheetModel();

  const existing = await RawRecoverySheet.findOne({
    packagingDate,
    vendorName,
    lineNumber,
  });

  if (existing) {
    throw createHttpError(
      409,
      `A Raw Recovery Sheet already exists for ${packagingDate}, ${vendorName}, Line ${lineNumber}`
    );
  }

  const sheet = await RawRecoverySheet.create({
    packagingDate,
    vendorName,
    lineNumber,
    rows: buildInitialRows(),
  });

  return sheet;
};

const getSheetById = async (id) => {
  const RawRecoverySheet = getRawRecoverySheetModel();
  const sheet = await RawRecoverySheet.findById(id);

  if (!sheet) {
    throw createHttpError(404, 'Raw Recovery Sheet not found');
  }

  return sheet;
};

const lookupSheet = async ({ packagingDate, vendorName, lineNumber }) => {
  const RawRecoverySheet = getRawRecoverySheetModel();

  const sheet = await RawRecoverySheet.findOne({
    packagingDate,
    vendorName,
    lineNumber,
  });

  if (!sheet) {
    throw createHttpError(404, 'Raw Recovery Sheet not found');
  }

  return sheet;
};

const getRow = async (sheetId, rowNumber) => {
  const sheet = await getSheetById(sheetId);
  const row = sheet.rows.find((item) => item.rowNumber === rowNumber);

  if (!row) {
    throw createHttpError(404, `Row ${rowNumber} not found`);
  }

  return {
    sheetId: sheet._id,
    packagingDate: sheet.packagingDate,
    vendorName: sheet.vendorName,
    lineNumber: sheet.lineNumber,
    row,
  };
};

const addBarcode = async (sheetId, rowNumber, barcodeScan) => {
  const sheet = await getSheetById(sheetId);
  const row = sheet.rows.find((item) => item.rowNumber === rowNumber);

  if (!row) {
    throw createHttpError(404, `Row ${rowNumber} not found`);
  }

  if (row.status === 'Completed') {
    throw createHttpError(
      409,
      `Row ${rowNumber} is already completed and cannot accept more barcodes`
    );
  }

  const duplicate = sheet.rows.some((sheetRow) =>
    sheetRow.barcodes.some(
      (barcode) => barcode.barcodeId === barcodeScan.barcodeId
    )
  );

  if (duplicate) {
    throw createHttpError(
      409,
      `Barcode ${barcodeScan.barcodeId} has already been scanned in this Recovery Sheet`
    );
  }

  if (row.status === 'Not Started') {
    row.status = 'In Progress';
    row.startedAt = new Date();
  }

  row.barcodes.push({
    ...barcodeScan,
    scannedAt: new Date(),
  });

  await sheet.save();

  return {
    sheetId: sheet._id,
    packagingDate: sheet.packagingDate,
    vendorName: sheet.vendorName,
    lineNumber: sheet.lineNumber,
    row,
  };
};

const completeRow = async (sheetId, rowNumber) => {
  const sheet = await getSheetById(sheetId);
  const row = sheet.rows.find((item) => item.rowNumber === rowNumber);

  if (!row) {
    throw createHttpError(404, `Row ${rowNumber} not found`);
  }

  if (row.status !== 'Completed') {
    if (!row.startedAt) {
      row.startedAt = new Date();
    }

    row.status = 'Completed';
    row.completedAt = new Date();
    await sheet.save();
  }

  return {
    sheetId: sheet._id,
    packagingDate: sheet.packagingDate,
    vendorName: sheet.vendorName,
    lineNumber: sheet.lineNumber,
    row,
    allRowsCompleted: sheet.rows.every((item) => item.status === 'Completed'),
  };
};

const listVendors = async (packagingDate) => {
  const BarcodeModel = getBarcodeModelForPackageDate(packagingDate);
  const documents = await BarcodeModel.find({})
    .select({ vendorName: 1, _id: 0 })
    .sort({ vendorName: 1 })
    .lean();

  return [...new Set(documents.map((item) => item.vendorName).filter(Boolean))];
};

const listLines = async ({ packagingDate, vendorName }) => {
  const BarcodeModel = getBarcodeModelForPackageDate(packagingDate);
  const document = await BarcodeModel.findOne({ vendorName }).lean();

  if (!document) {
    return [];
  }

  return [...new Set(document.lines.map((line) => line.lineNumber))].sort(
    (a, b) => a - b
  );
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  createSheet,
  getSheetById,
  lookupSheet,
  getRow,
  addBarcode,
  completeRow,
  listVendors,
  listLines,
};
