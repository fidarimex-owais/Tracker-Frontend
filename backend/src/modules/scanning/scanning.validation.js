const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

const normalizeId = (value) =>
  typeof value === 'string' ? value.trim() : '';

const extractIdFromQrValue = (value) => {
  if (value && typeof value === 'object') {
    return normalizeId(value._id);
  }

  const text = normalizeId(value);

  if (!text) {
    return '';
  }

  // Backward-compatible: also allow a QR that contains only the ObjectId.
  if (OBJECT_ID_RE.test(text)) {
    return text;
  }

  try {
    const parsed = JSON.parse(text);
    return normalizeId(parsed?._id);
  } catch {
    return '';
  }
};

const validateRecordId = (req, res, next) => {
  const directId = normalizeId(req.body?._id);
  const scannedId = extractIdFromQrValue(req.body?.qrValue);
  const id = directId || scannedId;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'MongoDB _id is required',
      errors: [
        {
          field: '_id',
          message:
            'Send _id directly or send qrValue containing the plain MongoDB ObjectId',
        },
      ],
    });
  }

  if (!OBJECT_ID_RE.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid MongoDB _id',
      errors: [
        {
          field: '_id',
          message: '_id must be a valid MongoDB ObjectId',
        },
      ],
    });
  }

  req.body = {
    _id: id,
  };

  return next();
};

module.exports = {
  validateRecordId,
  extractIdFromQrValue,
};
