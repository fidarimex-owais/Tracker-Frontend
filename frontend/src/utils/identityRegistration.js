export const MAX_IDENTITY_DOCUMENTS = 5;
export const MIN_IDENTITY_DOCUMENT_BYTES = 1024;
export const MAX_IDENTITY_DOCUMENT_BYTES = 100 * 1024;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^[2-9][0-9]{11}$/;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

export const normalizePan = (value) =>
  String(value || '').trim().toUpperCase().replace(/\s+/g, '');

export const normalizeAadhaar = (value) =>
  String(value || '').replace(/\D/g, '');

export const isValidPan = (value) => PAN_RE.test(normalizePan(value));

export const isValidAadhaar = (value) => {
  const digits = normalizeAadhaar(value);
  if (!AADHAAR_RE.test(digits)) return false;
  let checksum = 0;
  const reversed = digits.split('').reverse().map(Number);
  reversed.forEach((digit, index) => {
    checksum = D[checksum][P[index % 8][digit]];
  });
  return checksum === 0;
};

export const validateIdentityFiles = (files) => {
  const list = Array.from(files || []);
  if (list.length > MAX_IDENTITY_DOCUMENTS) {
    return 'You can upload a maximum of 5 documents';
  }
  for (const file of list) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return 'Documents must be PDF, JPG, JPEG, or PNG files';
    }
    if (file.size < MIN_IDENTITY_DOCUMENT_BYTES) {
      return `${file.name} must be at least 1 KB`;
    }
    if (file.size > MAX_IDENTITY_DOCUMENT_BYTES) {
      return `${file.name} must be 100 KB or smaller`;
    }
  }
  return '';
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: reader.result,
    });
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });

export const filesToIdentityPayload = async (files) =>
  Promise.all(Array.from(files || []).map(fileToDataUrl));

export const formatBytes = (bytes) =>
  bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
