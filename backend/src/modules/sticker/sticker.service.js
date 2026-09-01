// Sticker rendering and ZIP generation dependencies

const { ZipArchive } = require('archiver');
const sharp = require('sharp');
const { generateQrBase64 } = require('../qr/qr.service');
const { renderBarcodeForEmbed } = require('../barcode/barcode.render');

// Define the dimensions and layout used by each sticker

const getStickerDimensions = () => {
  const margin = 24;
  const qrSize = 220;
  const width = 500;
  const gapAroundDivider = 20;
  const barcodeAreaHeight = 90;

  const topSectionBottom = margin + qrSize;
  const hDividerY = topSectionBottom + margin;
  const barcodeY = hDividerY + margin;
  const barcodeTextY = barcodeY + barcodeAreaHeight + 30;
  const height = barcodeTextY + margin;

  return {
    margin,
    qrSize,
    width,
    height,
    gapAroundDivider,
    barcodeAreaHeight,
    hDividerY,
    barcodeY,
    barcodeTextY,
    topSectionBottom,
  };
};

// Build the QR, hand number and barcode sticker as SVG

const buildStickerSVG = async (qrPngBase64, numberOfHands, barcodeId) => {
  const dimensions = getStickerDimensions();
  const {
    margin,
    qrSize,
    width,
    height,
    gapAroundDivider,
    barcodeAreaHeight,
    hDividerY,
    barcodeY,
    barcodeTextY,
    topSectionBottom,
  } = dimensions;

  const dividerX = margin + qrSize + gapAroundDivider;
  const barcodeAreaWidth = width - margin * 2;
  const { viewBox: barcodeViewBox, innerSvg: barcodeInner } =
    renderBarcodeForEmbed(barcodeId);

  const numberZoneLeft = dividerX + gapAroundDivider;
  const numberZoneRight = width - margin;
  const numberCenterX = (numberZoneLeft + numberZoneRight) / 2;
  const numberCenterY = margin + qrSize / 2;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="16" fill="#ffffff" />
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="15" fill="none" stroke="#d1d5db" stroke-width="2" />

  <image x="${margin}" y="${margin}" width="${qrSize}" height="${qrSize}" href="data:image/png;base64,${qrPngBase64}" />

  <line x1="${dividerX}" y1="${margin}" x2="${dividerX}" y2="${topSectionBottom}" stroke="#9ca3af" stroke-width="1.5" />

  <text x="${numberCenterX}" y="${numberCenterY}" dominant-baseline="central" font-family="sans-serif" font-weight="bold" font-size="130" text-anchor="middle" fill="#000000">${numberOfHands}</text>

  <line x1="${margin}" y1="${hDividerY}" x2="${width - margin}" y2="${hDividerY}" stroke="#9ca3af" stroke-width="1.5" />

  <svg x="${(width - barcodeAreaWidth) / 2}" y="${barcodeY}" width="${barcodeAreaWidth}" height="${barcodeAreaHeight}" viewBox="${barcodeViewBox}" preserveAspectRatio="none">
    ${barcodeInner}
  </svg>

  <text x="${width / 2}" y="${barcodeTextY}" font-family="sans-serif" font-size="26" text-anchor="middle" fill="#000000">${barcodeId}</text>
</svg>`;
};

// Render the sticker SVG into a printable PNG

const buildStickerPNG = async (
  qrPngBase64,
  numberOfHands,
  barcodeId,
  scale = 3
) => {
  const svg = await buildStickerSVG(qrPngBase64, numberOfHands, barcodeId);
  const { width, height } = getStickerDimensions();

  return sharp(Buffer.from(svg), { density: 72 * scale })
    .resize({ width: width * scale, height: height * scale })
    .png()
    .toBuffer();
};

// Build a safe ZIP filename for the selected hand category

const buildZipFilename = (numberOfHands, brandName, packageDate) => {
  const dateString = new Date(packageDate).toISOString().slice(0, 10);
  const safeBrand = brandName.replace(/\s+/g, '');

  return `${numberOfHands}Hand_${dateString}_${safeBrand}.zip`;
};

// Generate all category stickers and stream them as a ZIP download

const streamCategoryZip = async ({
  numberOfHands,
  qrPayload,
  qrUniqueId,
  brandName,
  packageDate,
  barcodeIds,
  res,
}) => {
  const qrPngBase64 = await generateQrBase64(qrPayload ?? qrUniqueId);
  const zipFilename = buildZipFilename(numberOfHands, brandName, packageDate);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${zipFilename}"`
  );

  const archive = new ZipArchive({ zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    let settled = false;

    const resolveOnce = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const rejectOnce = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    res.once('close', resolveOnce);
    res.once('finish', resolveOnce);
    archive.once('error', rejectOnce);
    archive.pipe(res);

    (async () => {
      for (const barcodeId of barcodeIds) {
        // Each unique sticker is delivered as two IDENTICAL physical copies:
        // one for inside the box and one for outside the box. Both files reuse
        // the same rendered PNG, QR payload and barcode ID; no new identity is
        // generated for the second copy.
        const pngBuffer = await buildStickerPNG(
          qrPngBase64,
          numberOfHands,
          barcodeId
        );

        archive.append(pngBuffer, { name: `${barcodeId}_inside.png` });
        archive.append(pngBuffer, { name: `${barcodeId}_outside.png` });
      }

      await archive.finalize();
    })().catch(rejectOnce);
  });

  return { zipFilename };
};

// Build the browser print page containing all generated stickers

const buildPrintPageHTML = async ({
  qrPayload,
  qrUniqueId,
  numberOfHands,
  barcodeIds,
}) => {
  const qrPngBase64 = await generateQrBase64(qrPayload ?? qrUniqueId);
  const stickerImages = [];

  for (const barcodeId of barcodeIds) {
    const pngBuffer = await buildStickerPNG(
      qrPngBase64,
      numberOfHands,
      barcodeId,
      2
    );

    stickerImages.push({
      barcodeId,
      base64: pngBuffer.toString('base64'),
    });
  }

  // Render each unique sticker twice as an identical pair. The same base64
  // image is reused for both copies, so QR, barcode, hand number, dimensions
  // and print quality are guaranteed to match exactly.
  const imageTags = stickerImages
    .flatMap(({ barcodeId, base64 }) => [
      `<div class="sticker" data-copy="inside"><img src="data:image/png;base64,${base64}" alt="${barcodeId} - inside copy" /></div>`,
      `<div class="sticker" data-copy="outside"><img src="data:image/png;base64,${base64}" alt="${barcodeId} - outside copy" /></div>`,
    ])
    .join('\n');

  const physicalStickerCount = stickerImages.length * 2;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${numberOfHands} Hand Stickers - Print</title>
  <style>
    body { margin: 0; padding: 16px; font-family: sans-serif; background: #fff; }
    .toolbar { margin-bottom: 16px; }
    .toolbar button {
      padding: 8px 16px; font-size: 14px; cursor: pointer;
      background: #1e3a8a; color: #fff; border: none; border-radius: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .sticker {
      border: 1px solid #d1d5db;
      padding: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sticker img { width: 100%; height: auto; display: block; }

    @media print {
      .toolbar { display: none; }
      .grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print (${physicalStickerCount} stickers)</button>
  </div>
  <div class="grid">
    ${imageTags}
  </div>
  <script>
    window.addEventListener('load', () => {
      window.print();
    });
  </script>
</body>
</html>`;
};

// Export sticker rendering and delivery functions

module.exports = {
  getStickerDimensions,
  buildStickerSVG,
  buildStickerPNG,
  buildZipFilename,
  streamCategoryZip,
  buildPrintPageHTML,
};
