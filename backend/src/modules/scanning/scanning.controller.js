const scanningService = require('./scanning.service');

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

module.exports = {
  scanQr,
};
