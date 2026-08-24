const service = require('./qrBrandDetails.service');

const listDetails = async (req, res) => {
  const data = await service.listDetails(req.query);

  res.json({
    success: true,
    data,
  });
};

const listOptions = async (req, res) => {
  const data = await service.listOptions(req.query);

  res.json({
    success: true,
    data,
  });
};

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

module.exports = {
  listDetails,
  listOptions,
  deleteRecord,
};
