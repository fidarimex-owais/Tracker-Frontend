const crypto = require('crypto');

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const randomSevenChars = () => {
  let result = '';

  for (let index = 0; index < 7; index += 1) {
    result += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }

  return result;
};

/**
 * Generates unique IDs within one generated sticker batch using the same
 * format as the existing project: <7 random alphanumeric chars>-<hands>.
 */
const generateBarcodeIds = (numberOfHands, count) => {
  if (![4, 5, 6, 8].includes(numberOfHands)) {
    throw new Error(`Unsupported numberOfHands: ${numberOfHands}`);
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }

  const seen = new Set();
  const ids = [];
  let attempts = 0;
  const maxAttempts = count * 20;

  while (ids.length < count) {
    attempts += 1;

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

module.exports = {
  generateBarcodeIds,
};
