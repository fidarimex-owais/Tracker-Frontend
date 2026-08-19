const {
  findRecordDocumentById,
} = require('./scanning.model');

const scanQr = async (recordId) => {
  const result = await findRecordDocumentById(recordId);

  if (!result) {
    throw createHttpError(404, 'QR data not found');
  }

  const { brandName, document } = result;

  // Return the complete stored parent document. Express/Mongoose will
  // serialize ObjectIds as strings and Date values as ISO date strings.
  return {
    brandName,
    record: document,
  };
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  scanQr,
};
