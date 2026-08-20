const service = require('./recovery.service');

const getGenerationStatus = async (req, res) => {
  const data = await service.getGenerationStatus(req.params.rawSheetId);

  res.json({
    success: true,
    data,
  });
};

const generateRecoverySheet = async (req, res) => {
  const result = await service.generateRecoverySheet(req.params.rawSheetId);

  res.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created
      ? 'Recovery Sheet generated successfully'
      : 'Recovery Sheet was already generated',
    data: result.sheet,
  });
};

const getRecoverySheet = async (req, res) => {
  const sheet = await service.getRecoverySheetById(req.params.id);

  res.json({
    success: true,
    data: sheet,
  });
};

const getRecoverySheetByRawId = async (req, res) => {
  const sheet = await service.getRecoverySheetByRawId(req.params.rawSheetId);

  res.json({
    success: true,
    data: sheet,
  });
};

const listRecoverySheetOptions = async (req, res) => {
  const options = await service.listRecoverySheetOptions();

  res.json({
    success: true,
    data: options,
  });
};

const findRecoverySheet = async (req, res) => {
  const sheet = await service.findRecoverySheet(req.recoveryLookup);

  res.json({
    success: true,
    data: sheet,
  });
};

module.exports = {
  getGenerationStatus,
  generateRecoverySheet,
  getRecoverySheet,
  getRecoverySheetByRawId,
  listRecoverySheetOptions,
  findRecoverySheet,
};
