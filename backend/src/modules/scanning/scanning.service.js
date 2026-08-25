// QR scanning service dependency

const {
  findRecordDocumentById,
} = require('./scanning.model');

// Find and return the complete QR parent record

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

// Create an HTTP-aware service error

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Export scanning service functions

module.exports = {
  scanQr,
};
