const { getModelForBrand } = require('./records.model');
const { generateBarcodeIds } = require('../barcode/barcode.service');

const HAND_VALUES = [4, 5, 6, 8];

/**
 * Creates one line under the brand/package-date document.
 *
 * Records owns persistence. Barcode generation is delegated to the barcode
 * module; QR images and sticker files are not generated during this write.
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
  return { conflict: false, line: formatLine(payload, newLine) };
};

/**
 * Resolves a duplicate line-number conflict.
 * - reuse: returns the existing line unchanged.
 * - update: replaces mutable line data and regenerates QR category
 *   subdocuments + barcode IDs from the newly submitted quantities.
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
    return { line: formatLine({ brandName, packageDate }, line) };
  }

  if (action !== 'update') {
    throw createHttpError(400, `Invalid action "${action}". Must be "reuse" or "update".`);
  }

  line.vendorName = payload.vendorName;
  line.farmerName = payload.farmerName;
  line.supervisor = payload.supervisor;
  line.weight = payload.weight;
  line.address = payload.address;
  line.geolocation = payload.geolocation;
  line.qrCodes = buildQrCodes(payload.quantities);

  await document.save();

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
    qrUniqueId: qrCategory._id.toString(),
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
