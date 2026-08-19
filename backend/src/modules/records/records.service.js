const { getModelForBrand } = require('./records.model');
const {
  generateBarcodeIds,
  syncLineToBarcodeDatabase,
  removeBarcodeLine,
} = require('../barcode/barcode.service');

const HAND_VALUES = [4, 5, 6, 8];

const syncSavedLine = async ({
  Model,
  document,
  line,
  brandName,
}) => {
  await syncLineToBarcodeDatabase({
    packageDate: document.packageDate,
    vendorName: line.vendorName,
    brandName,
    line,
    sourceCollection: Model.collection.collectionName,
    sourcePackageId: document._id,
  });
};

/**
 * Creates one line under the brand/package-date document.
 *
 * The original data remains in qr_brand_details. After the QR record is
 * saved, the same line + generated barcode IDs are mirrored into barcode_data.
 */
const submitLine = async (payload) => {
  const Model = getModelForBrand(payload.brandName);
  let document = await Model.findOne({ packageDate: payload.packageDate });

  if (!document) {
    document = new Model({
      brandName: payload.brandName,
      packageDate: payload.packageDate,
      lines: [buildLine(payload)],
    });

    await document.save();
    const newLine = document.lines[document.lines.length - 1];

    await syncSavedLine({
      Model,
      document,
      line: newLine,
      brandName: payload.brandName,
    });

    return { conflict: false, line: formatLine(payload, newLine) };
  }

  const existingLine = document.lines.find(
    (line) => line.lineNumber === payload.lineNumber
  );

  if (existingLine) {
    return {
      conflict: true,
      brandName: payload.brandName,
      packageDate: payload.packageDate,
      lineNumber: payload.lineNumber,
      existingLine: formatLine(
        { brandName: payload.brandName, packageDate: payload.packageDate },
        existingLine
      ),
      submittedPayload: payload,
    };
  }

  document.lines.push(buildLine(payload));
  await document.save();

  const newLine = document.lines[document.lines.length - 1];

  await syncSavedLine({
    Model,
    document,
    line: newLine,
    brandName: payload.brandName,
  });

  return { conflict: false, line: formatLine(payload, newLine) };
};

/**
 * Resolves a duplicate line-number conflict.
 * - reuse: returns the existing line unchanged and ensures barcode_data has
 *   the same mirrored data.
 * - update: replaces mutable line data, regenerates QR/barcode IDs, and then
 *   replaces the mirrored barcode_data line.
 */
const resolveConflict = async ({ brandName, packageDate, lineNumber, action, payload }) => {
  const Model = getModelForBrand(brandName);
  const document = await Model.findOne({ packageDate });

  if (!document) {
    throw createHttpError(404, 'No document found for this brand and packageDate');
  }

  const line = document.lines.find((item) => item.lineNumber === lineNumber);

  if (!line) {
    throw createHttpError(404, 'No matching lineNumber found in this document');
  }

  if (action === 'reuse') {
    await syncSavedLine({
      Model,
      document,
      line,
      brandName,
    });

    return { line: formatLine({ brandName, packageDate }, line) };
  }

  if (action !== 'update') {
    throw createHttpError(400, `Invalid action "${action}". Must be "reuse" or "update".`);
  }

  const previousVendorName = line.vendorName;

  line.vendorName = payload.vendorName;
  line.farmerName = payload.farmerName;
  line.supervisor = payload.supervisor;
  line.weight = payload.weight;
  line.address = payload.address;
  line.geolocation = payload.geolocation;
  line.qrCodes = buildQrCodes(payload.quantities);

  await document.save();

  await syncSavedLine({
    Model,
    document,
    line,
    brandName,
  });

  if (previousVendorName !== line.vendorName) {
    await removeBarcodeLine({
      packageDate: document.packageDate,
      vendorName: previousVendorName,
      lineNumber,
    });
  }

  return { line: formatLine({ brandName, packageDate }, line) };
};

/**
 * Read-only lookup used by sticker delivery (download + print).
 * No IDs or images are generated here; it returns persisted QR/barcode data.
 */
const getCategoryForDelivery = async ({ brandName, packageDate, lineNumber, numberOfHands }) => {
  const Model = getModelForBrand(brandName);
  const document = await Model.findOne({ packageDate });

  if (!document) {
    throw createHttpError(404, 'No document found for this brand and packageDate');
  }

  const line = document.lines.find((item) => item.lineNumber === lineNumber);

  if (!line) {
    throw createHttpError(404, 'No matching lineNumber found');
  }

  const qrCategory = line.qrCodes.find(
    (item) => item.numberOfHands === numberOfHands
  );

  if (!qrCategory) {
    throw createHttpError(404, `No ${numberOfHands}-hand category found on this line`);
  }

  return {
    // Every physical QR for this parent record encodes ONLY the plain
    // parent MongoDB ObjectId string, for example:
    // 6a8579ab27e6a71a5ddf7993
    qrPayload: document._id.toString(),
    numberOfHands: qrCategory.numberOfHands,
    quantity: qrCategory.quantity,
    barcodeIds: qrCategory.stickers.map((sticker) => sticker.barcodeId),
  };
};

const buildQrCodes = (quantities) =>
  HAND_VALUES.filter((numberOfHands) => (quantities[numberOfHands] ?? 0) > 0).map(
    (numberOfHands) => ({
      numberOfHands,
      quantity: quantities[numberOfHands],
      stickers: generateBarcodeIds(numberOfHands, quantities[numberOfHands]).map(
        (barcodeId) => ({ barcodeId })
      ),
    })
  );

const buildLine = (payload) => ({
  lineNumber: payload.lineNumber,
  vendorName: payload.vendorName,
  farmerName: payload.farmerName,
  supervisor: payload.supervisor,
  weight: payload.weight,
  address: payload.address,
  geolocation: payload.geolocation,
  qrCodes: buildQrCodes(payload.quantities),
});

const formatLine = (context, line) => ({
  brandName: context.brandName,
  packageDate: context.packageDate,
  lineNumber: line.lineNumber,
  vendorName: line.vendorName,
  farmerName: line.farmerName,
  supervisor: line.supervisor,
  weight: line.weight,
  address: line.address,
  geolocation: line.geolocation,
  categories: line.qrCodes.map((qrCategory) => ({
    numberOfHands: qrCategory.numberOfHands,
    quantity: qrCategory.quantity,
  })),
});

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  submitLine,
  resolveConflict,
  getCategoryForDelivery,
};
