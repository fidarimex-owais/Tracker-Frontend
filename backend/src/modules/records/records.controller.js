// Records controller dependencies

const recordsService = require('./records.service');
const stickerService = require('../sticker/sticker.service');

// Create a QR record line or return an existing-line conflict

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

// Resolve duplicate line conflicts by reusing or updating data

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
// Download persisted QR/barcode stickers as a ZIP

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

// Build the printable sticker preview

const printPreview = async (req, res) => {
  const query = parseDeliveryQuery(req.query);
  const category = await recordsService.getCategoryForDelivery(query);
  const html = await stickerService.buildPrintPageHTML(category);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
};

// Validate and normalize sticker delivery query parameters

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

// Export records controller handlers

module.exports = {
  createRecord,
  resolveConflict,
  downloadZip,
  printPreview,
};
