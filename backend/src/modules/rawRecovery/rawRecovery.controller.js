// Raw Recovery controller dependency

const service = require('./rawRecovery.service');

// Create a Raw Recovery Sheet

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

// Add a scanned barcode to the selected row

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

// Mark the selected row as completed

const completeRow = async (req, res) => {
  const data = await service.completeRow(req.params.id, req.rowNumber);

  res.json({
    success: true,
    message: `Row ${req.rowNumber} marked as Completed`,
    data,
  });
};

// Save the completed Raw Recovery Sheet

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


// Return whether reset requires deleting a generated Recovery Sheet

const getResetStatus = async (req, res) => {
  const data = await service.getResetStatus(req.params.id);
  res.json({ success: true, data });
};

// Reset Raw Recovery data using the Admin confirmation flag

const resetSheet = async (req, res) => {
  const data = await service.resetSheetData(req.params.id, {
    deleteGeneratedRecovery: req.body?.deleteGeneratedRecovery === true,
  });

  res.json({
    success: true,
    message: data.recoveryDeleted
      ? 'Generated Recovery Sheet deleted and Raw Recovery Sheet reset successfully'
      : 'Raw Recovery Sheet reset successfully',
    data,
  });
};

// Unlock a saved sheet for permitted roles

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

// Return vendors for the selected packaging date

const listVendors = async (req, res) => {
  const vendors = await service.listVendors(req.packagingDate);

  res.json({
    success: true,
    packagingDate: req.packagingDate,
    vendors,
  });
};

// Return line numbers for the selected vendor

const listLines = async (req, res) => {
  const lines = await service.listLines(req.vendorLookup);

  res.json({
    success: true,
    packagingDate: req.vendorLookup.packagingDate,
    vendorName: req.vendorLookup.vendorName,
    lines,
  });
};

// Export Raw Recovery controller handlers

module.exports = {
  createSheet,
  getSheet,
  lookupSheet,
  getRow,
  scanBarcode,
  completeRow,
  saveSheet,
  getResetStatus,
  resetSheet,
  editSheet,
  reopenRow,
  removeBarcode,
  addRow,
  removeRow,
  listVendors,
  listLines,
};
