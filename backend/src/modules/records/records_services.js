const { getModelForBrand } = require('./records_model');
const { generateBarcodeIds, generateCategoryZip } = require('./sticker_generator');
const fs = require('fs');
const path = require('path');

const HAND_VALUES = [4, 5, 6, 8];

// Where generated ZIPs are written on disk before being served for download.
const OUTPUT_DIR = path.join(__dirname, 'generated-zips');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * POST /api/records
 * Builds one qrCodes[] entry PER HAND CATEGORY WITH quantity > 0 (categories
 * left at 0 are skipped entirely — not created as empty placeholders).
 * ZIP files are generated AFTER the document saves (they need the real
 * subdocument _id as the QR payload, which only exists post-save).
 */
const submitLine = async (payload) => {
  const Model = getModelForBrand(payload.brandName);

  let doc = await Model.findOne({ packageDate: payload.packageDate });

  if (!doc) {
    doc = new Model({
      brandName: payload.brandName,
      packageDate: payload.packageDate,
      lines: [buildLine(payload)],
    });
    await doc.save();
    const newLine = doc.lines[doc.lines.length - 1];
    const zips = await generateZipsForLine(payload.brandName, payload.packageDate, newLine);
    return { conflict: false, line: formatLine(payload, newLine), zips };
  }

  const existingLine = doc.lines.find((l) => l.lineNumber === payload.lineNumber);

  if (existingLine) {
    return {
      conflict: true,
      brandName: payload.brandName,
      packageDate: payload.packageDate,
      lineNumber: payload.lineNumber,
      existingLine: formatLine(
        { brandName: payload.brandName, packageDate: payload.packageDate },
        existingLine
      ),
      submittedPayload: payload,
    };
  }

  doc.lines.push(buildLine(payload));
  await doc.save();
  const newLine = doc.lines[doc.lines.length - 1];
  const zips = await generateZipsForLine(payload.brandName, payload.packageDate, newLine);
  return { conflict: false, line: formatLine(payload, newLine), zips };
};

/**
 * POST /api/records/resolve
 * 'reuse' -> return existing line's data AND regenerate ZIPs from its
 *   EXISTING barcodeIds (no new IDs, no new data written) so the user can
 *   re-download even if the ZIP files from the first generation are gone.
 * 'update' -> overwrite line fields, generate brand NEW qrCodes/stickers
 *   (new uniqueIds, new barcodeIds) from the newly submitted quantities,
 *   and generate fresh ZIPs.
 */
const resolveConflict = async ({ brandName, packageDate, lineNumber, action, payload }) => {
  const Model = getModelForBrand(brandName);

  const doc = await Model.findOne({ packageDate });
  if (!doc) {
    const err = new Error('No document found for this brand and packageDate');
    err.statusCode = 404;
    throw err;
  }

  const line = doc.lines.find((l) => l.lineNumber === lineNumber);
  if (!line) {
    const err = new Error('No matching lineNumber found in this document');
    err.statusCode = 404;
    throw err;
  }

  if (action === 'reuse') {
    const zips = await generateZipsForLine(brandName, packageDate, line);
    return { line: formatLine({ brandName, packageDate }, line), zips };
  }

  if (action === 'update') {
    line.vendorName = payload.vendorName;
    line.farmerName = payload.farmerName;
    line.supervisor = payload.supervisor;
    line.weight = payload.weight;
    line.address = payload.address;
    line.geolocation = payload.geolocation;
    line.qrCodes = buildQrCodes(payload.quantities);

    await doc.save();
    const zips = await generateZipsForLine(brandName, packageDate, line);
    return { line: formatLine({ brandName, packageDate }, line), zips };
  }

  const err = new Error(`Invalid action "${action}". Must be "reuse" or "update".`);
  err.statusCode = 400;
  throw err;
};

/**
 * Builds the qrCodes array for a line: one entry per hand category with
 * quantity > 0. Barcode IDs are generated NOW (they don't depend on the
 * document's _id — only the QR payload does).
 */
const buildQrCodes = (quantities) =>
  HAND_VALUES.filter((h) => (quantities[h] ?? 0) > 0).map((h) => ({
    numberOfHands: h,
    quantity: quantities[h],
    stickers: generateBarcodeIds(h, quantities[h]).map((barcodeId) => ({ barcodeId })),
  }));

const buildLine = (payload) => ({
  lineNumber: payload.lineNumber,
  vendorName: payload.vendorName,
  farmerName: payload.farmerName,
  supervisor: payload.supervisor,
  weight: payload.weight,
  address: payload.address,
  geolocation: payload.geolocation,
  qrCodes: buildQrCodes(payload.quantities),
});

/**
 * Generates one ZIP per hand category present on this line. Every sticker
 * inside embeds the SAME QR (encoding this category's qrCodes[i]._id) and
 * that sticker's own EXISTING barcodeId (never generates new ones here —
 * barcodeIds are only ever created in buildQrCodes, at line-creation or
 * update time, so re-downloading never changes a sticker's identity).
 */
const generateZipsForLine = async (brandName, packageDate, lineSubdoc) => {
  const results = [];

  for (const qr of lineSubdoc.qrCodes) {
    const { zipFilename } = await generateCategoryZip({
      numberOfHands: qr.numberOfHands,
      qrUniqueId: qr._id.toString(),
      brandName,
      packageDate,
      outputDir: OUTPUT_DIR,
      barcodeIds: qr.stickers.map((s) => s.barcodeId),
    });
    results.push({
      numberOfHands: qr.numberOfHands,
      quantity: qr.quantity,
      zipFilename,
    });
  }

  return results;
};

const formatLine = (ctx, lineSubdoc) => ({
  brandName: ctx.brandName,
  packageDate: ctx.packageDate,
  lineNumber: lineSubdoc.lineNumber,
  vendorName: lineSubdoc.vendorName,
  farmerName: lineSubdoc.farmerName,
  supervisor: lineSubdoc.supervisor,
  weight: lineSubdoc.weight,
  address: lineSubdoc.address,
  geolocation: lineSubdoc.geolocation,
  qrCodes: lineSubdoc.qrCodes.map((qr) => ({
    numberOfHands: qr.numberOfHands,
    quantity: qr.quantity,
    uniqueId: qr._id.toString(),
  })),
});

module.exports = {
  submitLine,
  resolveConflict,
};