// QR scanning controller dependency

const scanningService = require('./scanning.service');

// Retrieve QR data for the validated scanned record ID

const scanQr = async (req, res) => {
  const data = await scanningService.scanQr(
    req.body._id
  );

  return res.status(200).json({
    success: true,
    message: 'QR data retrieved successfully',
    data,
  });
};

// Export QR scanning controller handlers

module.exports = {
  scanQr,
};
