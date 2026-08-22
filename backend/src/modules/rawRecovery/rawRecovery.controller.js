const service = require('./rawRecovery.service');

const createSheet = async (req, res) => {
  const sheet = await service.createSheet(req.body);

  res.status(201).json({
    success: true,
    message: 'Raw Recovery Sheet created successfully',
    data: sheet,
  });
};

const getSheet = async (req, res) => {
  const sheet = await service.getSheetById(req.params.id);

  res.json({
    success: true,
    data: sheet,
  });
};

const lookupSheet = async (req, res) => {
  const sheet = await service.lookupSheet(req.lookup);

  res.json({
    success: true,
    data: sheet,
  });
};

const getRow = async (req, res) => {
  const data = await service.getRow(req.params.id, req.rowNumber);

  res.json({
    success: true,
    data,
  });
};

const scanBarcode = async (req, res) => {
  const data = await service.addBarcode(
    req.params.id,
    req.rowNumber,
    req.barcodeScan
  );

  res.status(201).json({
    success: true,
    message: `${req.barcodeScan.barcodeId} added to Row ${req.rowNumber}`,
    data,
  });
};

const completeRow = async (req, res) => {
  const data = await service.completeRow(req.params.id, req.rowNumber);

  res.json({
    success: true,
    message: `Row ${req.rowNumber} marked as Completed`,
    data,
  });
};

const saveSheet = async (req, res) => {
  const data = await service.saveCompletedSheet(req.params.id);

  res.json({
    success: true,
    message: data.recoveryCreated
      ? 'Raw Recovery Sheet saved and Recovery Sheet generated successfully'
      : 'Raw Recovery Sheet saved. Recovery Sheet was already generated',
    data,
  });
};


const editSheet = async (req, res) => {
  const data = await service.editSavedSheet(req.params.id);

  res.json({
    success: true,
    message: data.recoveryDeleted
      ? 'Raw Recovery Sheet unlocked for editing. Existing Recovery Sheet removed until the sheet is saved again'
      : 'Raw Recovery Sheet unlocked for editing',
    data,
  });
};

const reopenRow = async (req, res) => {
  const data = await service.reopenRow(req.params.id, req.rowNumber);

  res.json({
    success: true,
    message: `Row ${req.rowNumber} reopened for editing`,
    data,
  });
};

const removeBarcode = async (req, res) => {
  const data = await service.removeBarcode(
    req.params.id,
    req.rowNumber,
    req.params.barcodeId
  );

  res.json({
    success: true,
    message: `${req.params.barcodeId} removed from Row ${req.rowNumber}`,
    data,
  });
};

const addRow = async (req, res) => {
  const data = await service.addRow(req.params.id);

  res.status(201).json({
    success: true,
    message: `Row ${data.addedRowNumber} added`,
    data,
  });
};

const removeRow = async (req, res) => {
  const data = await service.removeRow(req.params.id, req.rowNumber);

  res.json({
    success: true,
    message: `Row ${data.removedRowNumber} removed`,
    data,
  });
};

const listVendors = async (req, res) => {
  const vendors = await service.listVendors(req.packagingDate);

  res.json({
    success: true,
    packagingDate: req.packagingDate,
    vendors,
  });
};

const listLines = async (req, res) => {
  const lines = await service.listLines(req.vendorLookup);

  res.json({
    success: true,
    packagingDate: req.vendorLookup.packagingDate,
    vendorName: req.vendorLookup.vendorName,
    lines,
  });
};

module.exports = {
  createSheet,
  getSheet,
  lookupSheet,
  getRow,
  scanBarcode,
  completeRow,
  saveSheet,
  editSheet,
  reopenRow,
  removeBarcode,
  addRow,
  removeRow,
  listVendors,
  listLines,
};
