const {
  getRecoverySheetModel,
  ROW_COUNT,
} = require('./recovery.model');
const {
  getRawRecoverySheetModel,
} = require('../rawRecovery/rawRecovery.model');

const roundToTwoDecimals = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const calculateRecoveryRow = (rawRow) => {
  const counts = {
    4: 0,
    5: 0,
    6: 0,
    8: 0,
  };

  for (const barcode of rawRow.barcodes || []) {
    if (Object.prototype.hasOwnProperty.call(counts, barcode.handNumber)) {
      counts[barcode.handNumber] += 1;
    }
  }

  const total = counts[4] + counts[5] + counts[6] + counts[8];
  const recoveryPercentage =
    total === 0
      ? 0
      : roundToTwoDecimals(((total - counts[8]) / total) * 100);

  return {
    rowNumber: rawRow.rowNumber,
    fourHand: counts[4],
    fiveHand: counts[5],
    sixHand: counts[6],
    eightHand: counts[8],
    total,
    recoveryPercentage,
  };
};

const getRawSheetById = async (rawSheetId) => {
  const RawRecoverySheet = getRawRecoverySheetModel();
  const rawSheet = await RawRecoverySheet.findById(rawSheetId);

  if (!rawSheet) {
    throw createHttpError(404, 'Raw Recovery Sheet not found');
  }

  return rawSheet;
};

const getIncompleteRows = (rawSheet) =>
  rawSheet.rows
    .filter((row) => row.status !== 'Completed')
    .map((row) => row.rowNumber);

const getGenerationStatus = async (rawSheetId) => {
  const rawSheet = await getRawSheetById(rawSheetId);
  const incompleteRows = getIncompleteRows(rawSheet);
  const RecoverySheet = getRecoverySheetModel();
  const existing = await RecoverySheet.findOne({
    rawRecoverySheetId: rawSheet._id,
  })
    .select({ _id: 1 })
    .lean();

  return {
    rawRecoverySheetId: rawSheet._id,
    totalRows: ROW_COUNT,
    completedRows: ROW_COUNT - incompleteRows.length,
    incompleteRows,
    canGenerate: incompleteRows.length === 0,
    alreadyGenerated: Boolean(existing),
    recoverySheetId: existing?._id || null,
  };
};

const generateRecoverySheet = async (rawSheetId) => {
  const rawSheet = await getRawSheetById(rawSheetId);

  if (!Array.isArray(rawSheet.rows) || rawSheet.rows.length !== ROW_COUNT) {
    throw createHttpError(
      409,
      'Raw Recovery Sheet must contain exactly 11 rows before generation'
    );
  }

  const incompleteRows = getIncompleteRows(rawSheet);

  if (incompleteRows.length > 0) {
    throw createHttpError(
      409,
      `Recovery Sheet cannot be generated until all 11 rows are Completed. Incomplete rows: ${incompleteRows.join(', ')}`
    );
  }

  const RecoverySheet = getRecoverySheetModel();
  const existing = await RecoverySheet.findOne({
    rawRecoverySheetId: rawSheet._id,
  });

  if (existing) {
    return {
      sheet: existing,
      created: false,
    };
  }

  const rows = [...rawSheet.rows]
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map(calculateRecoveryRow);

  const sheet = await RecoverySheet.create({
    rawRecoverySheetId: rawSheet._id,
    packagingDate: rawSheet.packagingDate,
    vendorName: rawSheet.vendorName,
    lineNumber: rawSheet.lineNumber,
    rows,
    sourceRawUpdatedAt: rawSheet.updatedAt,
    generatedAt: new Date(),
  });

  return {
    sheet,
    created: true,
  };
};

const getRecoverySheetById = async (id) => {
  const RecoverySheet = getRecoverySheetModel();
  const sheet = await RecoverySheet.findById(id);

  if (!sheet) {
    throw createHttpError(404, 'Recovery Sheet not found');
  }

  return sheet;
};

const getRecoverySheetByRawId = async (rawSheetId) => {
  const RecoverySheet = getRecoverySheetModel();
  const sheet = await RecoverySheet.findOne({
    rawRecoverySheetId: rawSheetId,
  });

  if (!sheet) {
    throw createHttpError(
      404,
      'Recovery Sheet has not been generated for this Raw Recovery Sheet'
    );
  }

  return sheet;
};

const listRecoverySheetOptions = async () => {
  const RecoverySheet = getRecoverySheetModel();

  const sheets = await RecoverySheet.find({})
    .select({
      packagingDate: 1,
      vendorName: 1,
      lineNumber: 1,
      generatedAt: 1,
    })
    .sort({
      packagingDate: -1,
      vendorName: 1,
      lineNumber: 1,
    })
    .lean();

  return sheets.map((sheet) => ({
    id: sheet._id.toString(),
    packagingDate: sheet.packagingDate,
    vendorName: sheet.vendorName,
    lineNumber: sheet.lineNumber,
    generatedAt: sheet.generatedAt,
  }));
};

const findRecoverySheet = async ({
  packagingDate,
  vendorName,
  lineNumber,
}) => {
  const RecoverySheet = getRecoverySheetModel();

  const sheet = await RecoverySheet.findOne({
    packagingDate,
    vendorName,
    lineNumber,
  });

  if (!sheet) {
    throw createHttpError(
      404,
      'Recovery Sheet not found for the selected Packaging Date, Vendor Name, and Line Number'
    );
  }

  return sheet;
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  calculateRecoveryRow,
  getGenerationStatus,
  generateRecoverySheet,
  getRecoverySheetById,
  getRecoverySheetByRawId,
  listRecoverySheetOptions,
  findRecoverySheet,
};
