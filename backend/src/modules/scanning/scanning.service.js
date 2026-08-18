const mongoose = require('mongoose');
const { ALL_BRANDS, getModelForBrand } = require('../records/records.model');

const resolveCode = async (rawCode) => {
  const code = String(rawCode || '').trim();
  if (!code) throw createHttpError(400, 'code is required');

  for (const brandName of ALL_BRANDS) {
    const Model = getModelForBrand(brandName);
    let document = null;

    if (mongoose.isValidObjectId(code)) {
      document = await Model.findOne({ 'lines.qrCodes._id': code });
    }
    if (!document) {
      document = await Model.findOne({ 'lines.qrCodes.stickers.barcodeId': code });
    }
    if (!document) continue;

    for (const line of document.lines) {
      for (const qrCategory of line.qrCodes) {
        const qrMatch = qrCategory._id.toString() === code;
        const sticker = qrCategory.stickers.find((item) => item.barcodeId === code);
        if (qrMatch || sticker) {
          return {
            type: qrMatch ? 'qr' : 'barcode',
            code,
            brandName,
            packageDate: document.packageDate,
            lineNumber: line.lineNumber,
            vendorName: line.vendorName,
            farmerName: line.farmerName,
            supervisor: line.supervisor,
            weight: line.weight,
            address: line.address,
            geolocation: line.geolocation,
            numberOfHands: qrCategory.numberOfHands,
            quantity: qrCategory.quantity,
            qrUniqueId: qrCategory._id.toString(),
            barcodeId: sticker?.barcodeId || null,
          };
        }
      }
    }
  }

  throw createHttpError(404, 'No QR code or barcode record found');
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { resolveCode };
