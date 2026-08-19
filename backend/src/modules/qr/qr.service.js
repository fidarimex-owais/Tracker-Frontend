const QRCode = require('qrcode');

const normalizeQrPayload = (payload) => {
  if (payload === undefined || payload === null || payload === '') {
    const error = new Error('QR payload is required to generate a QR code');
    error.statusCode = 400;
    throw error;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch (error) {
    const payloadError = new Error('QR payload could not be serialized');
    payloadError.statusCode = 400;
    payloadError.cause = error;
    throw payloadError;
  }
};

const generateQrPngBuffer = async (payload, options = {}) => {
  const qrText = normalizeQrPayload(payload);

  return QRCode.toBuffer(qrText, {
    width: 200,
    margin: 1,
    ...options,
  });
};

const generateQrBase64 = async (payload, options = {}) => {
  const pngBuffer = await generateQrPngBuffer(payload, options);
  return pngBuffer.toString('base64');
};

module.exports = {
  normalizeQrPayload,
  generateQrPngBuffer,
  generateQrBase64,
};
