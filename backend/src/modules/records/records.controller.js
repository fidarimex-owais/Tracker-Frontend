const recordsService = require('./records.service');
const stickerService = require('../sticker/sticker.service');

const createRecord = async (req, res) => {
  const result = await recordsService.submitLine(req.body);

  if (result.conflict) {
    return res.status(409).json({
      success: false,
      conflict: true,
      message: `Line ${result.lineNumber} already exists for ${result.brandName} on this package date.`,
      data: {
        brandName: result.brandName,
        packageDate: result.packageDate,
        lineNumber: result.lineNumber,
        existingLine: result.existingLine,
        submittedPayload: result.submittedPayload,
      },
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Line created',
    data: result.line,
  });
};

const resolveConflict = async (req, res) => {
  const result = await recordsService.resolveConflict(req.body);

  return res.status(200).json({
    success: true,
    message:
      req.body.action === 'reuse'
        ? 'Existing data returned, no changes made'
        : 'Line updated',
    data: result.line,
  });
};

/**
 * Kept under /api/records for backward compatibility with the current
 * frontend. Records retrieves the persisted data; sticker.service owns the
 * rendering/ZIP work.
 */
const downloadZip = async (req, res) => {
  const query = parseDeliveryQuery(req.query);
  const category = await recordsService.getCategoryForDelivery(query);

  await stickerService.streamCategoryZip({
    ...category,
    brandName: query.brandName,
    packageDate: query.packageDate,
    res,
  });
};

const printPreview = async (req, res) => {
  const query = parseDeliveryQuery(req.query);
  const category = await recordsService.getCategoryForDelivery(query);
  const html = await stickerService.buildPrintPageHTML(category);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
};

const parseDeliveryQuery = ({ brandName, packageDate, lineNumber, numberOfHands }) => {
  if (!brandName || !packageDate || !lineNumber || !numberOfHands) {
    const error = new Error(
      'Missing required query params: brandName, packageDate, lineNumber, numberOfHands'
    );
    error.statusCode = 400;
    throw error;
  }

  const parsedDate = new Date(packageDate);
  const parsedLineNumber = Number(lineNumber);
  const parsedNumberOfHands = Number(numberOfHands);

  if (Number.isNaN(parsedDate.getTime())) {
    const error = new Error('packageDate must be a valid date');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(parsedLineNumber) || parsedLineNumber <= 0) {
    const error = new Error('lineNumber must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  if (![4, 5, 6, 8].includes(parsedNumberOfHands)) {
    const error = new Error('numberOfHands must be one of: 4, 5, 6, 8');
    error.statusCode = 400;
    throw error;
  }

  return {
    brandName,
    packageDate: parsedDate,
    lineNumber: parsedLineNumber,
    numberOfHands: parsedNumberOfHands,
  };
};

module.exports = {
  createRecord,
  resolveConflict,
  downloadZip,
  printPreview,
};
