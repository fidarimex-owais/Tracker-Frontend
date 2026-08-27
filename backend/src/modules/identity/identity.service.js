const crypto = require('crypto');

const ENCRYPTION_VERSION = 'v1';
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getEncryptionKey = () => {
  const secret = String(
    process.env.IDENTITY_DATA_ENCRYPTION_KEY || ''
  ).trim();

  if (secret.length < 32) {
    throw createHttpError(
      500,
      'IDENTITY_DATA_ENCRYPTION_KEY must be configured with at least 32 characters'
    );
  }

  return crypto
    .createHash('sha256')
    .update(secret, 'utf8')
    .digest();
};

const encryptSensitiveValue = (value) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
};

const decryptSensitiveValue = (encryptedValue) => {
  const parts = String(encryptedValue || '').split(':');

  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw createHttpError(
      500,
      'Stored identity data has an unsupported encryption format'
    );
  }

  const [, ivBase64, tagBase64, encryptedBase64] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivBase64, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const getCloudinaryConfig = () => {
  const cloudName = String(
    process.env.CLOUDINARY_CLOUD_NAME || ''
  ).trim();
  const apiKey = String(
    process.env.CLOUDINARY_API_KEY || ''
  ).trim();
  const apiSecret = String(
    process.env.CLOUDINARY_API_SECRET || ''
  ).trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw createHttpError(
      500,
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
  };
};

const signCloudinaryParams = (params, apiSecret) => {
  const signatureBase = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${signatureBase}${apiSecret}`)
    .digest('hex');
};

const safeFolderPart = (value) =>
  String(value || 'registration')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .slice(0, 80) || 'registration';

const extensionForDocument = (document) => {
  if (document.type === 'application/pdf') {
    return 'pdf';
  }

  if (document.type === 'image/png') {
    return 'png';
  }

  return 'jpg';
};

const uploadDocument = async (document, folderKey) => {
  const {
    cloudName,
    apiKey,
    apiSecret,
  } = getCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder: `fidar-imex/identity-documents/${safeFolderPart(folderKey)}`,
    timestamp,
    type: 'authenticated',
  };

  const form = new FormData();
  form.set('file', document.dataUrl);
  form.set('folder', paramsToSign.folder);
  form.set('timestamp', String(timestamp));
  form.set('type', 'authenticated');
  form.set('api_key', apiKey);
  form.set(
    'signature',
    signCloudinaryParams(paramsToSign, apiSecret)
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    {
      method: 'POST',
      body: form,
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.public_id) {
    throw createHttpError(
      502,
      result?.error?.message || 'Unable to upload document to Cloudinary'
    );
  }

  return {
    publicId: result.public_id,
    assetId: result.asset_id || '',
    resourceType: result.resource_type || 'image',
    deliveryType: result.type || 'authenticated',
    format: result.format || extensionForDocument(document),
    originalName: document.name,
    mimeType: document.type,
    bytes: Number(result.bytes || document.size),
    uploadedAt: new Date(),
  };
};

const destroyDocument = async (document) => {
  if (!document?.publicId) {
    return;
  }

  const {
    cloudName,
    apiKey,
    apiSecret,
  } = getCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: document.publicId,
    timestamp,
    type: document.deliveryType || 'authenticated',
  };

  const form = new FormData();
  form.set('public_id', document.publicId);
  form.set('timestamp', String(timestamp));
  form.set('type', paramsToSign.type);
  form.set('api_key', apiKey);
  form.set(
    'signature',
    signCloudinaryParams(paramsToSign, apiSecret)
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
    {
      method: 'POST',
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Cloudinary cleanup failed for ${document.publicId}`
    );
  }
};

const cleanupDocuments = async (documents = []) => {
  const results = await Promise.allSettled(
    documents.map((document) => destroyDocument(document))
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(result.reason);
    }
  });
};

const uploadDocuments = async (documents = [], folderKey = '') => {
  if (documents.length === 0) {
    return [];
  }

  // Upload the small (<=100 KB) files concurrently to reduce registration time.
  const results = await Promise.allSettled(
    documents.map((document) =>
      uploadDocument(document, folderKey)
    )
  );

  const uploaded = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  const failed = results.find(
    (result) => result.status === 'rejected'
  );

  if (failed) {
    await cleanupDocuments(uploaded);
    throw failed.reason;
  }

  return uploaded;
};

const createIdentityRecord = async ({
  panNumber,
  aadhaarNumber,
  documents = [],
  folderKey,
}) => {
  // Encryption and uploads are independent once validation has completed.
  const panEncrypted = encryptSensitiveValue(panNumber);
  const aadhaarEncrypted = encryptSensitiveValue(aadhaarNumber);
  const uploadedDocuments = await uploadDocuments(
    documents,
    folderKey
  );

  return {
    panEncrypted,
    aadhaarEncrypted,
    panVerification: 'format_verified',
    aadhaarVerification: 'checksum_verified',
    verifiedAt: new Date(),
    documents: uploadedDocuments,
  };
};

const revealIdentityForAdmin = (identity) => {
  if (!identity?.panEncrypted || !identity?.aadhaarEncrypted) {
    return null;
  }

  return {
    panNumber: decryptSensitiveValue(identity.panEncrypted),
    aadhaarNumber: decryptSensitiveValue(identity.aadhaarEncrypted),
    panVerification: identity.panVerification || 'format_verified',
    aadhaarVerification:
      identity.aadhaarVerification || 'checksum_verified',
    verifiedAt: identity.verifiedAt || null,
    documents: (identity.documents || []).map((document) => ({
      id: document._id?.toString?.() || String(document._id || ''),
      originalName: document.originalName,
      mimeType: document.mimeType,
      bytes: document.bytes,
      uploadedAt: document.uploadedAt,
    })),
  };
};

const buildPrivateDocumentUrl = (document) => {
  const {
    cloudName,
    apiKey,
    apiSecret,
  } = getCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + DOWNLOAD_URL_TTL_SECONDS;
  const paramsToSign = {
    expires_at: expiresAt,
    format: document.format,
    public_id: document.publicId,
    timestamp,
    type: document.deliveryType || 'authenticated',
  };
  const signature = signCloudinaryParams(
    paramsToSign,
    apiSecret
  );
  const query = new URLSearchParams({
    timestamp: String(timestamp),
    public_id: document.publicId,
    format: document.format,
    type: paramsToSign.type,
    expires_at: String(expiresAt),
    signature,
    api_key: apiKey,
  });

  return {
    url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/download?${query.toString()}`,
    expiresAt: new Date(expiresAt * 1000),
  };
};

module.exports = {
  createIdentityRecord,
  revealIdentityForAdmin,
  buildPrivateDocumentUrl,
  cleanupDocuments,
};
