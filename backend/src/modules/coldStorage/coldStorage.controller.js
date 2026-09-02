const service = require('./coldStorage.service');

const createColdStorage = async (req, res) => {
  const coldStorage = await service.createColdStorage(req.body, req.user);

  return res.status(201).json({
    success: true,
    message: 'Cold Storage added successfully',
    coldStorage,
  });
};

const listColdStorages = async (req, res) => {
  const coldStorages = await service.listColdStorages({
    actorRole: req.user.role,
    includeInactive:
      String(req.query.includeInactive || '').toLowerCase() === 'true',
    vendorId: String(req.query.vendorId || '').trim(),
  });

  return res.json({
    success: true,
    coldStorages,
  });
};

const updateColdStorage = async (req, res) => {
  const coldStorage = await service.updateColdStorage(
    req.params.id,
    req.body
  );

  return res.json({
    success: true,
    message: 'Cold Storage updated successfully',
    coldStorage,
  });
};

const updateColdStorageStatus = async (req, res) => {
  const coldStorage = await service.updateColdStorageStatus(
    req.params.id,
    req.body.isActive
  );

  return res.json({
    success: true,
    message: coldStorage.isActive
      ? 'Cold Storage activated'
      : 'Cold Storage deactivated',
    coldStorage,
  });
};

const deleteColdStorage = async (req, res) => {
  await service.deleteColdStorage(req.params.id);

  return res.json({
    success: true,
    message: 'Cold Storage deleted',
  });
};

module.exports = {
  createColdStorage,
  listColdStorages,
  updateColdStorage,
  updateColdStorageStatus,
  deleteColdStorage,
};
