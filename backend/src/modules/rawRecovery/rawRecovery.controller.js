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
  listVendors,
  listLines,
};
