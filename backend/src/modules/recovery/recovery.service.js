// Recovery Sheet service dependencies

const {
  getRecoverySheetModel,
} = require('./recovery.model');
const {
  getRawRecoverySheetModel,
} = require('../rawRecovery/rawRecovery.model');

// Business timezone used for Vendor daily access

const BUSINESS_TIME_ZONE =
  process.env.BUSINESS_TIME_ZONE || 'Asia/Kolkata';

const getBusinessDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const isVendor = (actor) => actor?.role === 'vendor';

// Restrict Vendor access to today's Recovery Sheet

const assertVendorPackagingDateAccess = (actor, packagingDate) => {
  if (isVendor(actor) && packagingDate !== getBusinessDate()) {
    throw createHttpError(
      403,
      "Vendors can access only today's Recovery Sheet"
    );
  }
};

const roundToTwoDecimals = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

// Calculate hand totals, total quantity and recovery percentage

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

// Retrieve the source Raw Recovery Sheet

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

// Report completion, save and generation status for a Raw Recovery Sheet

const getGenerationStatus = async (rawSheetId, actor = null) => {
  const rawSheet = await getRawSheetById(rawSheetId);
  assertVendorPackagingDateAccess(actor, rawSheet.packagingDate);
  const incompleteRows = getIncompleteRows(rawSheet);
  const RecoverySheet = getRecoverySheetModel();
  const existing = await RecoverySheet.findOne({
    rawRecoverySheetId: rawSheet._id,
  })
    .select({ _id: 1 })
    .lean();

  return {
    rawRecoverySheetId: rawSheet._id,
    totalRows: rawSheet.rows.length,
    completedRows: rawSheet.rows.length - incompleteRows.length,
    incompleteRows,
    isSaved: Boolean(rawSheet.savedAt),
    savedAt: rawSheet.savedAt || null,
    canGenerate: Boolean(rawSheet.savedAt) && incompleteRows.length === 0,
    alreadyGenerated: Boolean(existing),
    recoverySheetId: existing?._id || null,
  };
};

// Generate Recovery Sheet rows from completed Raw Recovery data

const generateRecoverySheet = async (rawSheetId, actor = null) => {
  const rawSheet = await getRawSheetById(rawSheetId);
  assertVendorPackagingDateAccess(actor, rawSheet.packagingDate);

  if (!Array.isArray(rawSheet.rows) || rawSheet.rows.length < 1) {
    throw createHttpError(
      409,
      'Raw Recovery Sheet must contain at least one row before generation'
    );
  }

  const incompleteRows = getIncompleteRows(rawSheet);

  if (!rawSheet.savedAt) {
    throw createHttpError(
      409,
      'Save the completed Raw Recovery Sheet before generating a Recovery Sheet'
    );
  }

  if (incompleteRows.length > 0) {
    throw createHttpError(
      409,
      `Recovery Sheet cannot be generated until all rows are Completed. Incomplete rows: ${incompleteRows.join(', ')}`
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

// Retrieve a generated Recovery Sheet by ID

const getRecoverySheetById = async (id, actor = null) => {
  const RecoverySheet = getRecoverySheetModel();
  const sheet = await RecoverySheet.findById(id);

  if (!sheet) {
    throw createHttpError(404, 'Recovery Sheet not found');
  }

  assertVendorPackagingDateAccess(actor, sheet.packagingDate);

  return sheet;
};

const getRecoverySheetByRawId = async (rawSheetId, actor = null) => {
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

  assertVendorPackagingDateAccess(actor, sheet.packagingDate);

  return sheet;
};

// List available sheets while enforcing Vendor date restrictions

const listRecoverySheetOptions = async (actor = null) => {
  const RecoverySheet = getRecoverySheetModel();

  const query = isVendor(actor)
    ? { packagingDate: getBusinessDate() }
    : {};

  const sheets = await RecoverySheet.find(query)
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

// Find a generated sheet by packaging date, vendor and line

const findRecoverySheet = async ({
  packagingDate,
  vendorName,
  lineNumber,
}, actor = null) => {
  assertVendorPackagingDateAccess(actor, packagingDate);

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

// Permanently delete a generated Recovery Sheet

const deleteRecoverySheet = async (id) => {
  const RecoverySheet = getRecoverySheetModel();

  const sheet = await RecoverySheet.findByIdAndDelete(id);

  if (!sheet) {
    throw createHttpError(404, 'Recovery Sheet not found');
  }

  return sheet;
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Export Recovery Sheet service functions

module.exports = {
  getBusinessDate,
  calculateRecoveryRow,
  getGenerationStatus,
  generateRecoverySheet,
  getRecoverySheetById,
  getRecoverySheetByRawId,
  listRecoverySheetOptions,
  findRecoverySheet,
  deleteRecoverySheet,
};
