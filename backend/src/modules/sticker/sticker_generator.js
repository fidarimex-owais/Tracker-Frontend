const crypto = require('crypto');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const { ZipArchive } = require('archiver');
const sharp = require('sharp');

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates one random 7-character alphanumeric string (upper+lower+digit),
 * using crypto.randomInt for real randomness rather than Math.random.
 */
const randomSevenChars = () => {
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }
  return result;
};

/**
 * Generates `count` UNIQUE barcode IDs for one hand category, each in the
 * format "<7 random chars>-<numberOfHands>". Uniqueness is enforced within
 * this batch via a Set, regenerating on the (extremely rare, ~1 in 3.5
 * trillion) collision.
 */
const generateBarcodeIds = (numberOfHands, count) => {
  const seen = new Set();
  const ids = [];
  let attempts = 0;
  const maxAttempts = count * 20; // generous safety margin against collisions

  while (ids.length < count) {
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error(
        `Could not generate ${count} unique barcode IDs for ${numberOfHands} hands after ${maxAttempts} attempts`
      );
    }
    const candidate = `${randomSevenChars()}-${numberOfHands}`;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      ids.push(candidate);
    }
  }

  return ids;
};

/**
 * Builds ONE sticker as an SVG string, following the "Balanced Sticker
 * Design" spec: QR top-left (full, unclipped — must stay scannable),
 * number to its right separated by a vertical divider, barcode below
 * separated by a horizontal divider, barcode's number printed underneath
 * it. Equal margins on all sides, everything centered within its zone.
 *
 * qrPngBase64 is the SAME for every sticker in a category (same QR per
 * hand category, per spec) — caller generates it once and passes it in.
 */
/**
 * Single source of truth for sticker layout dimensions — used by both
 * buildStickerSVG (to draw at these coordinates) and buildStickerPNG (to
 * know the correct aspect ratio when rasterizing). Having buildStickerPNG
 * hardcode its own separate width/height was the bug that caused cropped
 * output — this function makes that class of bug impossible going forward.
 */
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

  return { margin, qrSize, width, height, gapAroundDivider, barcodeAreaHeight, hDividerY, barcodeY, barcodeTextY, topSectionBottom };
};

const buildStickerSVG = async (qrPngBase64, numberOfHands, barcodeId) => {
  const { margin, qrSize, width, height, gapAroundDivider, barcodeAreaHeight, hDividerY, barcodeY, barcodeTextY, topSectionBottom } =
    getStickerDimensions();

  const dividerX = margin + qrSize + gapAroundDivider;
  const barcodeAreaWidth = width - margin * 2;

  const barcodeSvg = bwipjs.toSVG({
    bcid: 'code128',
    text: barcodeId,
    scale: 2,
    height: 10,
    includetext: false,
  });

  const innerMatch = barcodeSvg.match(/<svg[^>]*viewBox="([^"]*)"[^>]*>([\s\S]*)<\/svg>/);
  const barcodeViewBox = innerMatch ? innerMatch[1] : '0 0 268 58';
  const barcodeInner = innerMatch ? innerMatch[2] : '';

  // Number is centered within its own zone: from just right of the divider
  // to the card's right margin.
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

/**
 * Renders one sticker to a PNG buffer via sharp (rasterizes the SVG built
 * by buildStickerSVG). scale=3 renders at 3x the base SVG size for
 * print-quality sharpness. Uses getStickerDimensions() as the single
 * source of truth for width/height — hardcoding a separate fixed size
 * here previously caused sharp to crop the output whenever the SVG's real
 * layout height changed but this resize target didn't.
 */
const buildStickerPNG = async (qrPngBase64, numberOfHands, barcodeId, scale = 3) => {
  const svg = await buildStickerSVG(qrPngBase64, numberOfHands, barcodeId);
  const { width, height } = getStickerDimensions();
  return sharp(Buffer.from(svg), { density: 72 * scale })
    .resize({ width: width * scale, height: height * scale })
    .png()
    .toBuffer();
};

/**
 * Computes the standard ZIP filename for a category, WITHOUT creating any
 * file — just the naming convention, used for the Content-Disposition
 * header when streaming.
 */
const buildZipFilename = (numberOfHands, brandName, packageDate) => {
  const dateStr = new Date(packageDate).toISOString().slice(0, 10);
  const safeBrand = brandName.replace(/\s+/g, '');
  return `${numberOfHands}Hand_${dateStr}_${safeBrand}.zip`;
};

/**
 * Streams a ZIP of all sticker PNGs for ONE hand category DIRECTLY to an
 * HTTP response — nothing is ever written to disk. barcodeIds must be the
 * ones already saved on the line's document (never generates new ones
 * here), so the same category always produces the same ZIP contents no
 * matter how many times it's downloaded.
 *
 * `res` must be an Express response object; this function sets the
 * necessary headers itself and pipes the archive straight into it.
 */
const streamCategoryZip = async ({ numberOfHands, qrUniqueId, brandName, packageDate, barcodeIds, res }) => {
  const qrPngBuffer = await QRCode.toBuffer(qrUniqueId, { width: 200, margin: 1 });
  const qrPngBase64 = qrPngBuffer.toString('base64');
  const zipFilename = buildZipFilename(numberOfHands, brandName, packageDate);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    res.on('close', resolve);
    archive.on('error', (err) => {
      reject(err);
    });
    archive.pipe(res);

    (async () => {
      for (let i = 0; i < barcodeIds.length; i++) {
        const pngBuffer = await buildStickerPNG(qrPngBase64, numberOfHands, barcodeIds[i]);
        archive.append(pngBuffer, { name: `${barcodeIds[i]}.png` });
      }
      archive.finalize();
    })().catch(reject);
  });

  return { zipFilename };
};

/**
 * Builds a full HTML page containing every sticker for one hand category,
 * laid out for printing (like a Word "Print Preview"): opens in a new tab,
 * auto-triggers the browser's native print dialog on load via window.print().
 *
 * Uses the browser's OWN print pagination via @media print CSS (page-break
 * rules) — this is exactly what "print like Word" means: the browser
 * handles page breaks, margins, and the print dialog itself; we just lay
 * out the content correctly.
 *
 * NOTE ON SCALE: every sticker's PNG is embedded inline as a base64 <img>
 * src. For small-to-moderate quantities (tens to low hundreds) this is
 * fine. For very large quantities (your 600 example), this produces a
 * large HTML response and a slow-loading tab — flagging this now rather
 * than after you hit it. If that turns out too slow in practice, the fix
 * is paginating print into batches (e.g. 50 at a time), not something
 * this version does.
 */
const buildPrintPageHTML = async ({ qrUniqueId, numberOfHands, barcodeIds }) => {
  const qrPngBuffer = await QRCode.toBuffer(qrUniqueId, { width: 200, margin: 1 });
  const qrPngBase64 = qrPngBuffer.toString('base64');

  const stickerImages = [];
  for (const barcodeId of barcodeIds) {
    const pngBuffer = await buildStickerPNG(qrPngBase64, numberOfHands, barcodeId, 2);
    stickerImages.push({ barcodeId, base64: pngBuffer.toString('base64') });
  }

  const imgTags = stickerImages
    .map(
      (s) =>
        `<div class="sticker"><img src="data:image/png;base64,${s.base64}" alt="${s.barcodeId}" /></div>`
    )
    .join('\n');

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
    <button onclick="window.print()">Print (${stickerImages.length} stickers)</button>
  </div>
  <div class="grid">
    ${imgTags}
  </div>
  <script>
    // Auto-open the print dialog once everything (including all embedded
    // images) has actually finished loading, not before.
    window.addEventListener('load', () => {
      window.print();
    });
  </script>
</body>
</html>`;
};

module.exports = {
  generateBarcodeIds,
  buildStickerSVG,
  buildStickerPNG,
  streamCategoryZip,
  buildZipFilename,
  buildPrintPageHTML,
  getStickerDimensions,
};