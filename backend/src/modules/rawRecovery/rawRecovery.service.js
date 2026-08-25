// Raw Recovery service dependencies

const {
  getRawRecoverySheetModel,
  buildInitialRows,
} = require('./rawRecovery.model');
const {
  getBarcodeModelForPackageDate,
} = require('../barcode/barcode.model');
const {
  getRecoverySheetModel,
} = require('../recovery/recovery.model');
const {
  generateRecoverySheet,
} = require('../recovery/recovery.service');

// Create a Raw Recovery Sheet after validating vendor and line data

const createSheet = async ({ packagingDate, vendorName, lineNumber }) => {
  await assertVendorLineExists({ packagingDate, vendorName, lineNumber });

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

  return RawRecoverySheet.create({
    packagingDate,
    vendorName,
    lineNumber,
    rows: buildInitialRows(),
  });
};

// Retrieve a Raw Recovery Sheet by MongoDB ID

const getSheetById = async (id) => {
  const RawRecoverySheet = getRawRecoverySheetModel();
  const sheet = await RawRecoverySheet.findById(id);

  if (!sheet) {
    throw createHttpError(404, 'Raw Recovery Sheet not found');
  }

  return sheet;
};

// Find a sheet using packaging date, vendor and line number

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

  return buildRowResponse(sheet, row);
};

// Validate and add a scanned barcode to the selected row

const addBarcode = async (sheetId, rowNumber, barcodeScan) => {
  const sheet = await getSheetById(sheetId);
  assertSheetNotSaved(sheet);
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

  await assertBarcodeBelongsToSheet(sheet, barcodeScan);

  if (row.status === 'Not Started') {
    row.status = 'In Progress';
    row.startedAt = new Date();
  }

  row.barcodes.push({
    ...barcodeScan,
    scannedAt: new Date(),
  });

  await sheet.save();

  return buildRowResponse(sheet, row);
};

// Mark an individual recovery row as completed

const completeRow = async (sheetId, rowNumber) => {
  const sheet = await getSheetById(sheetId);
  assertSheetNotSaved(sheet);
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
    ...buildRowResponse(sheet, row),
    allRowsCompleted: sheet.rows.every((item) => item.status === 'Completed'),
  };
};

// Add a new row while the sheet is still editable

const addRow = async (sheetId) => {
  const sheet = await getSheetById(sheetId);
  assertSheetNotSaved(sheet);
  await assertRecoveryNotGenerated(sheet._id);

  const nextRowNumber =
    Math.max(0, ...sheet.rows.map((row) => row.rowNumber)) + 1;

  sheet.rows.push({
    rowNumber: nextRowNumber,
    status: 'Not Started',
    barcodes: [],
    startedAt: null,
    completedAt: null,
  });

  await sheet.save();

  return {
    sheet,
    addedRowNumber: nextRowNumber,
  };
};

// Remove an unused row from an editable sheet

const removeRow = async (sheetId, rowNumber) => {
  const sheet = await getSheetById(sheetId);
  assertSheetNotSaved(sheet);
  await assertRecoveryNotGenerated(sheet._id);

  if (sheet.rows.length <= 1) {
    throw createHttpError(409, 'A Raw Recovery Sheet must keep at least one row');
  }

  const rowIndex = sheet.rows.findIndex(
    (item) => item.rowNumber === rowNumber
  );

  if (rowIndex < 0) {
    throw createHttpError(404, `Row ${rowNumber} not found`);
  }

  const row = sheet.rows[rowIndex];

  if (row.status !== 'Not Started' || row.barcodes.length > 0) {
    throw createHttpError(
      409,
      `Row ${rowNumber} can only be removed before scanning has started`
    );
  }

  sheet.rows.splice(rowIndex, 1);
  await sheet.save();

  return {
    sheet,
    removedRowNumber: rowNumber,
  };
};

// Save only after every row is complete and generate Recovery Sheet data

const saveCompletedSheet = async (sheetId) => {
  const sheet = await getSheetById(sheetId);

  if (!Array.isArray(sheet.rows) || sheet.rows.length < 1) {
    throw createHttpError(
      409,
      'Raw Recovery Sheet must contain at least one row before saving'
    );
  }

  const incompleteRows = sheet.rows
    .filter((row) => row.status !== 'Completed')
    .map((row) => row.rowNumber);

  if (incompleteRows.length > 0) {
    throw createHttpError(
      409,
      `All rows must be marked Complete before Save. Incomplete rows: ${incompleteRows.join(', ')}`
    );
  }

  if (!sheet.savedAt) {
    sheet.savedAt = new Date();
    await sheet.save();
  }

  const recoveryResult = await generateRecoverySheet(sheet._id);

  return {
    sheet,
    recoverySheet: recoveryResult.sheet,
    recoveryCreated: recoveryResult.created,
  };
};



// Check whether a generated Recovery Sheet already exists

const getResetStatus = async (sheetId) => {
  const sheet = await getSheetById(sheetId);
  const RecoverySheet = getRecoverySheetModel();
  const generatedRecoverySheet = await RecoverySheet.findOne({
    rawRecoverySheetId: sheet._id,
  }).select('_id');

  return {
    hasGeneratedRecoverySheet: Boolean(generatedRecoverySheet),
    recoverySheetId: generatedRecoverySheet?._id || null,
  };
};

// Reset scanned Raw Recovery data with generated-sheet protection

const resetSheetData = async (sheetId, { deleteGeneratedRecovery = false } = {}) => {
  const sheet = await getSheetById(sheetId);
  const RecoverySheet = getRecoverySheetModel();

  const generatedRecoverySheet = await RecoverySheet.findOne({
    rawRecoverySheetId: sheet._id,
  }).select('_id');

  // Never silently delete a generated Recovery Sheet. The Admin must explicitly
  // confirm the destructive combined action from the UI.
  if (generatedRecoverySheet && !deleteGeneratedRecovery) {
    const error = createHttpError(409, 'Recovery Sheet Already Exists');
    error.code = 'RECOVERY_SHEET_EXISTS';
    error.recoverySheetId = generatedRecoverySheet._id;
    throw error;
  }

  let recoveryDeleted = false;
  if (generatedRecoverySheet && deleteGeneratedRecovery) {
    const deleteResult = await RecoverySheet.deleteOne({
      _id: generatedRecoverySheet._id,
    });
    recoveryDeleted = deleteResult.deletedCount > 0;
  }

  // Preserve Packaging Date, Vendor, Line Number and the current row structure,
  // while clearing all scan/status/timestamp data.
  sheet.rows.forEach((row) => {
    row.status = 'Not Started';
    row.barcodes = [];
    row.startedAt = null;
    row.completedAt = null;
  });

  sheet.savedAt = null;
  await sheet.save();

  return { sheet, recoveryDeleted };
};

// Unlock a saved Raw Recovery Sheet for Admin/Sub-admin editing

const editSavedSheet = async (sheetId) => {
  const sheet = await getSheetById(sheetId);

  if (!sheet.savedAt) {
    throw createHttpError(
      409,
      'This Raw Recovery Sheet is already editable'
    );
  }

  // Remove the generated Recovery Sheet first so users never see stale
  // recovery totals while the source Raw Recovery Sheet is being edited.
  const RecoverySheet = getRecoverySheetModel();
  const deleteResult = await RecoverySheet.deleteOne({
    rawRecoverySheetId: sheet._id,
  });

  sheet.savedAt = null;
  await sheet.save();

  return {
    sheet,
    recoveryDeleted: deleteResult.deletedCount > 0,
  };
};

// Reopen a completed row so its barcode data can be edited

const reopenRow = async (sheetId, rowNumber) => {
  const sheet = await getSheetById(sheetId);
  assertSheetNotSaved(sheet);

  const row = sheet.rows.find((item) => item.rowNumber === rowNumber);

  if (!row) {
    throw createHttpError(404, `Row ${rowNumber} not found`);
  }

  if (row.status !== 'Completed') {
    return buildRowResponse(sheet, row);
  }

  row.status = row.barcodes.length > 0 ? 'In Progress' : 'Not Started';
  row.completedAt = null;

  if (row.barcodes.length > 0 && !row.startedAt) {
    row.startedAt = new Date();
  }

  await sheet.save();

  return buildRowResponse(sheet, row);
};

// Remove a barcode from an editable recovery row

const removeBarcode = async (sheetId, rowNumber, barcodeId) => {
  const sheet = await getSheetById(sheetId);
  assertSheetNotSaved(sheet);

  const row = sheet.rows.find((item) => item.rowNumber === rowNumber);

  if (!row) {
    throw createHttpError(404, `Row ${rowNumber} not found`);
  }

  if (row.status === 'Completed') {
    throw createHttpError(
      409,
      `Row ${rowNumber} is Completed. Reopen the row before editing its barcodes`
    );
  }

  const barcodeIndex = row.barcodes.findIndex(
    (barcode) => barcode.barcodeId === barcodeId
  );

  if (barcodeIndex < 0) {
    throw createHttpError(
      404,
      `Barcode ${barcodeId} was not found in Row ${rowNumber}`
    );
  }

  row.barcodes.splice(barcodeIndex, 1);
  row.completedAt = null;

  if (row.barcodes.length === 0) {
    row.status = 'Not Started';
    row.startedAt = null;
  } else {
    row.status = 'In Progress';
  }

  await sheet.save();

  return buildRowResponse(sheet, row);
};

const assertSheetNotSaved = (sheet) => {
  if (sheet.savedAt) {
    throw createHttpError(
      409,
      'This Raw Recovery Sheet has already been saved and is locked'
    );
  }
};

// Return vendors available in barcode data for a packaging date

const listVendors = async (packagingDate) => {
  const BarcodeModel = getBarcodeModelForPackageDate(packagingDate);
  const documents = await BarcodeModel.find({})
    .select({ vendorName: 1, _id: 0 })
    .sort({ vendorName: 1 })
    .lean();

  return [...new Set(documents.map((item) => item.vendorName).filter(Boolean))];
};

// Return available line numbers for the selected vendor

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

// Verify that the selected vendor and line exist in barcode data

const assertVendorLineExists = async ({
  packagingDate,
  vendorName,
  lineNumber,
}) => {
  const BarcodeModel = getBarcodeModelForPackageDate(packagingDate);
  const vendor = await BarcodeModel.findOne({ vendorName }).lean();

  if (!vendor) {
    throw createHttpError(
      404,
      `Vendor ${vendorName} was not found in barcode_data for ${packagingDate}`
    );
  }

  const line = vendor.lines.find((item) => item.lineNumber === lineNumber);

  if (!line) {
    throw createHttpError(
      404,
      `Line ${lineNumber} was not found for ${vendorName} on ${packagingDate}`
    );
  }

  return line;
};

// Ensure a scanned barcode belongs to this sheet's vendor and line

const assertBarcodeBelongsToSheet = async (sheet, barcodeScan) => {
  const line = await assertVendorLineExists({
    packagingDate: sheet.packagingDate,
    vendorName: sheet.vendorName,
    lineNumber: sheet.lineNumber,
  });

  const matchingCategory = line.barcodeData.find(
    (category) =>
      category.numberOfHands === barcodeScan.handNumber &&
      Array.isArray(category.barcodes) &&
      category.barcodes.includes(barcodeScan.barcodeId)
  );

  if (!matchingCategory) {
    throw createHttpError(
      404,
      `Barcode ${barcodeScan.barcodeId} does not belong to ${sheet.vendorName}, Line ${sheet.lineNumber} on ${sheet.packagingDate}`
    );
  }
};

const assertRecoveryNotGenerated = async (rawRecoverySheetId) => {
  const RecoverySheet = getRecoverySheetModel();
  const generated = await RecoverySheet.exists({ rawRecoverySheetId });

  if (generated) {
    throw createHttpError(
      409,
      'Rows cannot be added or removed after the Recovery Sheet has been generated'
    );
  }
};

const buildRowResponse = (sheet, row) => ({
  sheetId: sheet._id,
  packagingDate: sheet.packagingDate,
  vendorName: sheet.vendorName,
  lineNumber: sheet.lineNumber,
  row,
});

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Export Raw Recovery service functions

module.exports = {
  createSheet,
  getSheetById,
  lookupSheet,
  getRow,
  addBarcode,
  completeRow,
  saveCompletedSheet,
  getResetStatus,
  resetSheetData,
  editSavedSheet,
  reopenRow,
  removeBarcode,
  addRow,
  removeRow,
  listVendors,
  listLines,
};
