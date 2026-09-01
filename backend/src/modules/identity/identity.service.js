const crypto = require('crypto');
const { getUserDb } = require('../../config/db');
const {
  getIdentityRegistryModel,
  ensureIdentityRegistryIndexes,
} = require('./identity.registry.model');

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

const duplicateIdentityError = () =>
  createHttpError(
    409,
    'This PAN Card number or Aadhaar Card number is already registered to another account or pending registration.'
  );

const createIdentityLookupHash = (kind, value) =>
  crypto
    .createHmac('sha256', getEncryptionKey())
    .update(`identity-${kind}-v1:${String(value)}`, 'utf8')
    .digest('hex');

const normalizeRecordId = (value) => String(value || '');

const assertNoLegacyIdentityConflict = async ({
  panNumber,
  aadhaarNumber,
  excludeSource = '',
  excludeRecordId = '',
}) => {
  const userDb = getUserDb();
  const sources = [
    {
      source: 'user',
      collection: userDb.collection('credentials'),
    },
    {
      source: 'signup-request',
      collection: userDb.collection('signup_requests'),
    },
  ];

  for (const item of sources) {
    const cursor = item.collection.find(
      {
        'identity.panEncrypted': { $exists: true },
        'identity.aadhaarEncrypted': { $exists: true },
        $or: [
          { 'identity.registryId': { $exists: false } },
          { 'identity.registryId': null },
        ],
      },
      {
        projection: {
          _id: 1,
          'identity.panEncrypted': 1,
          'identity.aadhaarEncrypted': 1,
        },
      }
    );

    for await (const record of cursor) {
      if (
        item.source === excludeSource &&
        normalizeRecordId(record._id) === normalizeRecordId(excludeRecordId)
      ) {
        continue;
      }

      try {
        const existingPan = decryptSensitiveValue(
          record.identity?.panEncrypted
        );
        const existingAadhaar = decryptSensitiveValue(
          record.identity?.aadhaarEncrypted
        );

        if (
          existingPan === String(panNumber) ||
          existingAadhaar === String(aadhaarNumber)
        ) {
          throw duplicateIdentityError();
        }
      } catch (error) {
        if (error?.statusCode === 409) {
          throw error;
        }

        console.error(
          `Unable to inspect legacy identity record ${item.source}:${record._id}`,
          error
        );
        throw createHttpError(
          500,
          'Unable to verify PAN/Aadhaar uniqueness against existing identity records. Contact an Admin.'
        );
      }
    }
  }
};

const buildIdentityHashes = (panNumber, aadhaarNumber) => ({
  panHash: createIdentityLookupHash('pan', panNumber),
  aadhaarHash: createIdentityLookupHash('aadhaar', aadhaarNumber),
});

const assertIdentityNumbersAvailable = async ({
  panNumber,
  aadhaarNumber,
  currentRegistryId = null,
  excludeSource = '',
  excludeRecordId = '',
}) => {
  await Promise.all([
    ensureIdentityRegistryIndexes(),
    assertNoLegacyIdentityConflict({
      panNumber,
      aadhaarNumber,
      excludeSource,
      excludeRecordId,
    }),
  ]);

  const IdentityRegistry = getIdentityRegistryModel();
  const { panHash, aadhaarHash } = buildIdentityHashes(
    panNumber,
    aadhaarNumber
  );
  const filter = {
    $or: [
      { panHash },
      { aadhaarHash },
    ],
  };

  if (currentRegistryId) {
    filter._id = { $ne: currentRegistryId };
  }

  const conflict = await IdentityRegistry.findOne(filter)
    .select('_id')
    .lean();

  if (conflict) {
    throw duplicateIdentityError();
  }

  return {
    panHash,
    aadhaarHash,
  };
};

const reserveIdentityNumbers = async ({
  panNumber,
  aadhaarNumber,
  excludeSource = '',
  excludeRecordId = '',
}) => {
  const hashes = await assertIdentityNumbersAvailable({
    panNumber,
    aadhaarNumber,
    excludeSource,
    excludeRecordId,
  });
  const IdentityRegistry = getIdentityRegistryModel();

  try {
    return await IdentityRegistry.create(hashes);
  } catch (error) {
    if (error?.code === 11000) {
      throw duplicateIdentityError();
    }

    throw error;
  }
};

const releaseIdentityRegistry = async (identityOrRegistryId) => {
  const registryId =
    identityOrRegistryId?.registryId || identityOrRegistryId;

  if (!registryId) {
    return;
  }

  const IdentityRegistry = getIdentityRegistryModel();
  await IdentityRegistry.deleteOne({ _id: registryId });
};

const updateIdentityRegistry = async ({
  currentRegistryId,
  panNumber,
  aadhaarNumber,
  excludeSource = '',
  excludeRecordId = '',
}) => {
  const hashes = await assertIdentityNumbersAvailable({
    panNumber,
    aadhaarNumber,
    currentRegistryId,
    excludeSource,
    excludeRecordId,
  });
  const IdentityRegistry = getIdentityRegistryModel();

  if (!currentRegistryId) {
    try {
      const created = await IdentityRegistry.create(hashes);
      return {
        registryId: created._id,
        rollback: {
          created: true,
          registryId: created._id,
        },
      };
    } catch (error) {
      if (error?.code === 11000) {
        throw duplicateIdentityError();
      }

      throw error;
    }
  }

  const previous = await IdentityRegistry.findById(
    currentRegistryId
  ).lean();

  if (!previous) {
    try {
      const created = await IdentityRegistry.create(hashes);
      return {
        registryId: created._id,
        rollback: {
          created: true,
          registryId: created._id,
        },
      };
    } catch (error) {
      if (error?.code === 11000) {
        throw duplicateIdentityError();
      }

      throw error;
    }
  }

  try {
    await IdentityRegistry.findByIdAndUpdate(
      currentRegistryId,
      {
        $set: hashes,
      },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw duplicateIdentityError();
    }

    throw error;
  }

  return {
    registryId: currentRegistryId,
    rollback: {
      created: false,
      registryId: currentRegistryId,
      previous: {
        panHash: previous.panHash,
        aadhaarHash: previous.aadhaarHash,
      },
    },
  };
};

const rollbackIdentityRegistryUpdate = async (rollback) => {
  if (!rollback?.registryId) {
    return;
  }

  const IdentityRegistry = getIdentityRegistryModel();

  if (rollback.created) {
    await IdentityRegistry.deleteOne({
      _id: rollback.registryId,
    });
    return;
  }

  if (rollback.previous) {
    await IdentityRegistry.updateOne(
      { _id: rollback.registryId },
      { $set: rollback.previous }
    );
  }
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
  // Reserve PAN/Aadhaar before Cloudinary upload so two simultaneous requests
  // cannot claim the same identity numbers.
  const reservation = await reserveIdentityNumbers({
    panNumber,
    aadhaarNumber,
  });

  try {
    const panEncrypted = encryptSensitiveValue(panNumber);
    const aadhaarEncrypted = encryptSensitiveValue(aadhaarNumber);
    const uploadedDocuments = await uploadDocuments(
      documents,
      folderKey
    );

    return {
      registryId: reservation._id,
      panEncrypted,
      aadhaarEncrypted,
      panVerification: 'format_verified',
      aadhaarVerification: 'checksum_verified',
      verifiedAt: new Date(),
      documents: uploadedDocuments,
    };
  } catch (error) {
    await releaseIdentityRegistry(reservation._id);
    throw error;
  }
};

const prepareIdentityUpdate = async ({
  panNumber,
  aadhaarNumber,
  documents = [],
  folderKey,
  currentRegistryId = null,
  excludeSource = '',
  excludeRecordId = '',
}) => {
  // Check before uploading so obvious conflicts fail quickly. The registry
  // update below is still atomic and catches a race with another request.
  await assertIdentityNumbersAvailable({
    panNumber,
    aadhaarNumber,
    currentRegistryId,
    excludeSource,
    excludeRecordId,
  });

  const uploadedDocuments = await uploadDocuments(
    documents,
    folderKey
  );

  let registryUpdate;

  try {
    registryUpdate = await updateIdentityRegistry({
      currentRegistryId,
      panNumber,
      aadhaarNumber,
      excludeSource,
      excludeRecordId,
    });
  } catch (error) {
    await cleanupDocuments(uploadedDocuments);
    throw error;
  }

  return {
    registryId: registryUpdate.registryId,
    registryRollback: registryUpdate.rollback,
    panEncrypted: encryptSensitiveValue(panNumber),
    aadhaarEncrypted: encryptSensitiveValue(aadhaarNumber),
    panVerification: 'format_verified',
    aadhaarVerification: 'checksum_verified',
    verifiedAt: new Date(),
    uploadedDocuments,
  };
};

const cleanupIdentityRecord = async (identity) => {
  if (!identity) {
    return;
  }

  await cleanupDocuments(identity.documents || []);
  await releaseIdentityRegistry(identity.registryId);
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
  prepareIdentityUpdate,
  rollbackIdentityRegistryUpdate,
  cleanupIdentityRecord,
  releaseIdentityRegistry,
  revealIdentityForAdmin,
  buildPrivateDocumentUrl,
  cleanupDocuments,
};
