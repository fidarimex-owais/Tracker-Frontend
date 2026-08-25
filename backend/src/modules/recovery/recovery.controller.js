// Recovery Sheet controller dependency

const service = require('./recovery.service');

// Return generation status for a Raw Recovery Sheet

const getGenerationStatus = async (req, res) => {
  const data = await service.getGenerationStatus(req.params.rawSheetId, req.user);

  res.json({
    success: true,
    data,
  });
};

// Generate or return the Recovery Sheet for a Raw Recovery Sheet

const generateRecoverySheet = async (req, res) => {
  const result = await service.generateRecoverySheet(req.params.rawSheetId, req.user);

  res.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created
      ? 'Recovery Sheet generated successfully'
      : 'Recovery Sheet was already generated',
    data: result.sheet,
  });
};

// Return a generated Recovery Sheet by ID

const getRecoverySheet = async (req, res) => {
  const sheet = await service.getRecoverySheetById(req.params.id, req.user);

  res.json({
    success: true,
    data: sheet,
  });
};

// Return a Recovery Sheet using its Raw Recovery Sheet ID

const getRecoverySheetByRawId = async (req, res) => {
  const sheet = await service.getRecoverySheetByRawId(req.params.rawSheetId, req.user);

  res.json({
    success: true,
    data: sheet,
  });
};

// Return Recovery Sheet selector options for the current role

const listRecoverySheetOptions = async (req, res) => {
  const options = await service.listRecoverySheetOptions(req.user);

  res.json({
    success: true,
    data: options,
  });
};

// Find a Recovery Sheet by date, vendor and line

const findRecoverySheet = async (req, res) => {
  const sheet = await service.findRecoverySheet(req.recoveryLookup, req.user);

  res.json({
    success: true,
    data: sheet,
  });
};

// Delete a generated Recovery Sheet

const deleteRecoverySheet = async (req, res) => {
  const sheet = await service.deleteRecoverySheet(req.params.id);

  res.json({
    success: true,
    message: 'Recovery Sheet deleted successfully',
    data: {
      id: sheet._id.toString(),
    },
  });
};

// Export Recovery Sheet controller handlers

module.exports = {
  getGenerationStatus,
  generateRecoverySheet,
  getRecoverySheet,
  getRecoverySheetByRawId,
  listRecoverySheetOptions,
  findRecoverySheet,
  deleteRecoverySheet,
};
