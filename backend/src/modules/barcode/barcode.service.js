const crypto = require('crypto');
const {
  getBarcodeModelForPackageDate,
} = require('./barcode.model');

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const HAND_VALUES = [4, 5, 6, 8];

const randomSevenChars = () => {
  let result = '';

  for (let index = 0; index < 7; index += 1) {
    result += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }

  return result;
};

/**
 * Generates unique IDs within one generated sticker batch using the same
 * format as the existing project: <7 random alphanumeric chars>-<hands>.
 */
const generateBarcodeIds = (numberOfHands, count) => {
  if (!HAND_VALUES.includes(numberOfHands)) {
    throw new Error(`Unsupported numberOfHands: ${numberOfHands}`);
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }

  const seen = new Set();
  const ids = [];
  let attempts = 0;
  const maxAttempts = count * 20;

  while (ids.length < count) {
    attempts += 1;

    if (attempts > maxAttempts) {
      throw new Error(
        `Could not generate ${count} unique barcode IDs for ${numberOfHands} hands after ${maxAttempts} attempts`
      );
    }

    const candidate = `${randomSevenChars()}-${numberOfHands}`;

    if (!seen.has(candidate)) {
      seen.add(candidate);
      ids.push(candidate);
    }
  }

  return ids;
};

const buildQuantities = (line) => {
  const quantities = {
    4: 0,
    5: 0,
    6: 0,
    8: 0,
  };

  for (const category of line.qrCodes) {
    quantities[category.numberOfHands] = category.quantity;
  }

  return quantities;
};

const buildBarcodeData = (line) =>
  line.qrCodes.map((category) => ({
    numberOfHands: category.numberOfHands,
    quantity: category.quantity,
    qrUniqueId: category._id.toString(),
    barcodes: category.stickers.map((sticker) => sticker.barcodeId),
  }));

const buildBarcodeLine = ({
  line,
  brandName,
  sourceCollection,
  sourcePackageId,
}) => ({
  lineNumber: line.lineNumber,
  brandName,
  farmerName: line.farmerName,
  supervisor: line.supervisor,
  weight: line.weight,
  address: line.address,
  geolocation: {
    latitude: line.geolocation.latitude,
    longitude: line.geolocation.longitude,
  },
  quantities: buildQuantities(line),
  barcodeData: buildBarcodeData(line),
  source: {
    qrDatabase: 'qr_brand_details',
    qrCollection: sourceCollection,
    qrPackageId: sourcePackageId.toString(),
    qrLineId: line._id.toString(),
  },
  syncedAt: new Date(),
});

/**
 * Mirrors one saved QR-generation line into barcode_data.
 *
 * MongoDB mapping:
 * barcode_data database
 *   -> YYYY-MM-DD collection
 *      -> one document per vendorName
 *         -> lines[] with any natural-number lineNumber (1, 2, 3, ...)
 *            -> barcodeData[]
 */
const syncLineToBarcodeDatabase = async ({
  packageDate,
  vendorName,
  brandName,
  line,
  sourceCollection,
  sourcePackageId,
}) => {
  const BarcodeModel = getBarcodeModelForPackageDate(packageDate);
  const packageDateKey = new Date(packageDate).toISOString().slice(0, 10);
  const barcodeLine = buildBarcodeLine({
    line,
    brandName,
    sourceCollection,
    sourcePackageId,
  });

  let vendorDocument = await BarcodeModel.findOne({ vendorName });

  if (!vendorDocument) {
    vendorDocument = new BarcodeModel({
      packageDate: packageDateKey,
      vendorName,
      lines: [barcodeLine],
    });

    await vendorDocument.save();
    return;
  }

  const existingIndex = vendorDocument.lines.findIndex(
    (item) => item.lineNumber === line.lineNumber
  );

  if (existingIndex >= 0) {
    vendorDocument.lines[existingIndex] = barcodeLine;
  } else {
    vendorDocument.lines.push(barcodeLine);
  }

  await vendorDocument.save();
};

/**
 * Removes a stale mirrored line, for example if an existing QR line is
 * updated and its vendorName changes.
 */
const removeBarcodeLine = async ({
  packageDate,
  vendorName,
  lineNumber,
}) => {
  const BarcodeModel = getBarcodeModelForPackageDate(packageDate);
  const vendorDocument = await BarcodeModel.findOne({ vendorName });

  if (!vendorDocument) {
    return;
  }

  vendorDocument.lines = vendorDocument.lines.filter(
    (line) => line.lineNumber !== lineNumber
  );

  if (vendorDocument.lines.length === 0) {
    await vendorDocument.deleteOne();
    return;
  }

  await vendorDocument.save();
};

module.exports = {
  generateBarcodeIds,
  syncLineToBarcodeDatabase,
  removeBarcodeLine,
};
