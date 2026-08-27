// Identity validation and document-upload rules.
// PAN is validated by its standard structural format.
// Aadhaar is validated by length/range and the Verhoeff checksum.

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[2-9][0-9]{11}$/;

const MAX_DOCUMENTS = 5;
const MIN_DOCUMENT_BYTES = 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const normalizePan = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const normalizeAadhaar = (value) =>
  String(value || '')
    .replace(/\D/g, '');

const isValidPan = (value) => PAN_RE.test(normalizePan(value));

const hasValidVerhoeffChecksum = (digits) => {
  let checksum = 0;
  const reversed = String(digits)
    .split('')
    .reverse()
    .map(Number);

  for (let index = 0; index < reversed.length; index += 1) {
    checksum = VERHOEFF_D[checksum][
      VERHOEFF_P[index % 8][reversed[index]]
    ];
  }

  return checksum === 0;
};

const isValidAadhaar = (value) => {
  const normalized = normalizeAadhaar(value);
  return AADHAAR_RE.test(normalized) && hasValidVerhoeffChecksum(normalized);
};

const parseDocument = (document, index) => {
  const originalName = String(document?.name || '').trim();
  const mimeType = String(document?.type || '').trim().toLowerCase();
  const dataUrl = String(document?.dataUrl || '').trim();

  if (!originalName) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} must have a file name`,
      },
    };
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(mimeType)) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} must be a PDF, JPG, JPEG, or PNG file`,
      },
    };
  }

  const prefix = `data:${mimeType};base64,`;

  if (!dataUrl.startsWith(prefix)) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} has invalid file data`,
      },
    };
  }

  const base64 = dataUrl.slice(prefix.length);

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} has invalid encoded data`,
      },
    };
  }

  let bytes;

  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} could not be read`,
      },
    };
  }

  if (bytes.length < MIN_DOCUMENT_BYTES) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} must be at least 1 KB`,
      },
    };
  }

  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} must be 100 KB or smaller`,
      },
    };
  }

  const hasExpectedSignature =
    (mimeType === 'application/pdf' &&
      bytes.subarray(0, 5).toString('ascii') === '%PDF-') ||
    (mimeType === 'image/png' &&
      bytes.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      )) ||
    (mimeType === 'image/jpeg' &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff);

  if (!hasExpectedSignature) {
    return {
      error: {
        field: 'documents',
        message: `Document ${index + 1} content does not match its file type`,
      },
    };
  }

  return {
    document: {
      name: originalName.slice(0, 180),
      type: mimeType,
      size: bytes.length,
      dataUrl,
    },
  };
};

const validateIdentityPayload = (body = {}) => {
  const panNumber = normalizePan(body.panNumber);
  const aadhaarNumber = normalizeAadhaar(body.aadhaarNumber);
  const rawDocuments = Array.isArray(body.documents)
    ? body.documents
    : [];
  const errors = [];

  if (!isValidPan(panNumber)) {
    errors.push({
      field: 'panNumber',
      message: 'Enter a valid PAN number (example format: ABCDE1234F)',
    });
  }

  if (!isValidAadhaar(aadhaarNumber)) {
    errors.push({
      field: 'aadhaarNumber',
      message: 'Enter a valid 12-digit Aadhaar number with a valid checksum',
    });
  }

  if (rawDocuments.length > MAX_DOCUMENTS) {
    errors.push({
      field: 'documents',
      message: 'You can upload a maximum of 5 documents',
    });
  }

  const documents = [];

  rawDocuments.slice(0, MAX_DOCUMENTS).forEach((document, index) => {
    const parsed = parseDocument(document, index);

    if (parsed.error) {
      errors.push(parsed.error);
    } else {
      documents.push(parsed.document);
    }
  });

  return {
    panNumber,
    aadhaarNumber,
    documents,
    errors,
  };
};

module.exports = {
  MAX_DOCUMENTS,
  MIN_DOCUMENT_BYTES,
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_TYPES,
  normalizePan,
  normalizeAadhaar,
  isValidPan,
  isValidAadhaar,
  validateIdentityPayload,
};
