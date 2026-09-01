const path = require('path');
const fs = require('fs');
const recordService = require('./records_services');

// Same output dir the service writes ZIPs into.
const OUTPUT_DIR = path.join(__dirname, 'generated-zips');

/**
 * POST /api/records
 * 201 -> new line created. Response `data.zips` is an array of
 *        { numberOfHands, quantity, zipFilename } — one per requested
 *        hand category. Frontend downloads each via GET /api/records/download/:filename.
 * 409 -> conflict, nothing saved. See existing conflict handling.
 */
const createRecord = async (req, res, next) => {
  try {
    const result = await recordService.submitLine(req.body);

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
      message: 'Line created — stickers generated',
      data: { ...result.line, zips: result.zips },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/records/resolve
 */
const resolveConflict = async (req, res, next) => {
  try {
    const result = await recordService.resolveConflict(req.body);

    return res.status(200).json({
      success: true,
      message:
        req.body.action === 'reuse'
          ? 'Existing stickers returned, no changes made'
          : 'Line updated — stickers regenerated',
      data: { ...result.line, zips: result.zips },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

/**
 * GET /api/records/download/:filename
 * Streams a previously generated ZIP file. Filename must match exactly
 * what was returned in the zips array — this endpoint does not regenerate
 * anything, just serves the file already on disk.
 */
const downloadZip = (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal — only allow the exact filename pattern we
  // generate ourselves (NHand_YYYY-MM-DD_Brand.zip), reject anything else.
  if (!/^[0-9]+Hand_\d{4}-\d{2}-\d{2}_[A-Za-z0-9]+\.zip$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  const filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found. It may need to be regenerated.' });
  }

  res.download(filePath, filename);
};

module.exports = { createRecord, resolveConflict, downloadZip };