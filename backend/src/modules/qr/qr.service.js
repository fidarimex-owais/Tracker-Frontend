const QRCode = require('qrcode');

const generateQrPngBuffer = async (uniqueId, options = {}) => {
  if (!uniqueId) {
    const error = new Error('uniqueId is required to generate a QR code');
    error.statusCode = 400;
    throw error;
  }

  return QRCode.toBuffer(String(uniqueId), {
    width: 200,
    margin: 1,
    ...options,
  });
};

const generateQrBase64 = async (uniqueId, options = {}) => {
  const pngBuffer = await generateQrPngBuffer(uniqueId, options);
  return pngBuffer.toString('base64');
};

module.exports = {
  generateQrPngBuffer,
  generateQrBase64,
};
