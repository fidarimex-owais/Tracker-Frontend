// QR Brand Details controller dependency

const service = require('./qrBrandDetails.service');

// Return filtered QR Brand Detail records

const listDetails = async (req, res) => {
  const data = await service.listDetails(req.query);

  res.json({
    success: true,
    data,
  });
};

// Return available values for QR Brand Detail filters

const listOptions = async (req, res) => {
  const data = await service.listOptions(req.query);

  res.json({
    success: true,
    data,
  });
};

// Delete an individual QR Brand Detail record

const deleteRecord = async (req, res) => {
  const data = await service.deleteRecord({
    brandName: req.body?.brandName,
    packageId: req.params.packageId,
    lineId: req.params.lineId,
  });

  res.json({
    success: true,
    message: 'QR record deleted successfully',
    data,
  });
};

// Export QR Brand Details controller handlers

module.exports = {
  listDetails,
  listOptions,
  deleteRecord,
};
