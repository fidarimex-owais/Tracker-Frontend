const ALLOWED_BRANDS = ['Hi Banana', 'Joker', 'Banana Man'];
const ALLOWED_VENDORS = ['Yogesh Korhale', 'Sachin Markad', 'Tannaji Kashid'];
const HAND_CATEGORIES = [4, 5, 6, 8];

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const isValidISODate = (value) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

const BUSINESS_TIME_ZONE =
  process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';

const formatDateInBusinessTimeZone = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getBusinessToday = () =>
  formatDateInBusinessTimeZone(new Date());

const toDateOnlyString = (value) => {
  const rawValue = String(value || '').trim();
  const datePrefix = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);

  if (datePrefix) {
    return datePrefix[1];
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return formatDateInBusinessTimeZone(parsedDate);
};

const enforceSubadminPackageDate = (req, res, next) => {
  if (req.user?.role !== 'subadmin') {
    return next();
  }

  const packageDate =
    req.method === 'GET'
      ? req.query?.packageDate
      : req.body?.packageDate;

  // Existing validators handle missing or malformed date values.
  if (!packageDate || !isValidISODate(String(packageDate))) {
    return next();
  }

  const requestedDate = toDateOnlyString(packageDate);
  const today = getBusinessToday();

  if (requestedDate && requestedDate < today) {
    return res.status(400).json({
      success: false,
      message:
        'Sub-admin can generate QR codes only for today or future dates',
      errors: [
        {
          field: 'packageDate',
          message:
            'Past package dates are not allowed for Sub-admin QR generation',
        },
      ],
    });
  }

  return next();
};

const validateQuantities = (quantities, errors) => {
  if (
    typeof quantities !== 'object' ||
    quantities === null ||
    Array.isArray(quantities)
  ) {
    errors.push({
      field: 'quantities',
      message: 'quantities is required and must be an object',
    });
    return;
  }

  const keys = Object.keys(quantities);
  const unknownKeys = keys.filter(
    (key) => !HAND_CATEGORIES.includes(Number(key))
  );

  if (unknownKeys.length > 0) {
    errors.push({
      field: 'quantities',
      message: `quantities has unknown keys: ${unknownKeys.join(', ')}. Only 4, 5, 6, 8 are allowed.`,
    });
  }

  let anyPositive = false;

  for (const category of HAND_CATEGORIES) {
    const value = quantities[category] ?? quantities[String(category)];

    if (value === undefined) continue;

    if (!Number.isInteger(value) || value < 0) {
      errors.push({
        field: `quantities.${category}`,
        message: `quantities.${category} must be a non-negative integer`,
      });
      continue;
    }

    if (value > 0) anyPositive = true;
  }

  if (!anyPositive && unknownKeys.length === 0) {
    errors.push({
      field: 'quantities',
      message: 'At least one hand category must have a quantity greater than 0',
    });
  }
};

const validateLineFields = (body, errors) => {
  if (!isNonEmptyString(body.brandName)) {
    errors.push({
      field: 'brandName',
      message: 'brandName is required and must be a string',
    });
  } else if (!ALLOWED_BRANDS.includes(body.brandName)) {
    errors.push({
      field: 'brandName',
      message: `brandName must be one of: ${ALLOWED_BRANDS.join(', ')}`,
    });
  }

  if (!isNonEmptyString(body.vendorName)) {
    errors.push({ field: 'vendorName', message: 'vendorName is required and must be a string' });
  } else if (!ALLOWED_VENDORS.includes(body.vendorName.trim())) {
    errors.push({
      field: 'vendorName',
      message: `vendorName must be one of: ${ALLOWED_VENDORS.join(', ')}`,
    });
  }

  if (!isNonEmptyString(body.farmerName)) {
    errors.push({ field: 'farmerName', message: 'farmerName is required and must be a string' });
  }

  if (!isNonEmptyString(body.supervisor)) {
    errors.push({ field: 'supervisor', message: 'supervisor is required and must be a string' });
  }

  if (!Number.isInteger(body.lineNumber) || body.lineNumber < 1) {
    errors.push({
      field: 'lineNumber',
      message: 'lineNumber must be a natural number (positive integer)',
    });
  }

  if (!isFiniteNumber(body.weight) || body.weight <= 0) {
    errors.push({ field: 'weight', message: 'weight is required and must be a positive number' });
  }

  if (!isNonEmptyString(body.address)) {
    errors.push({ field: 'address', message: 'address is required and must be a string' });
  }

  if (!isValidISODate(body.packageDate)) {
    errors.push({
      field: 'packageDate',
      message: 'packageDate is required and must be a valid date (YYYY-MM-DD)',
    });
  }

  if (typeof body.geolocation !== 'object' || body.geolocation === null) {
    errors.push({
      field: 'geolocation',
      message: 'geolocation is required and must be an object',
    });
  } else {
    const { latitude, longitude } = body.geolocation;

    if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
      errors.push({
        field: 'geolocation.latitude',
        message: 'latitude must be a number between -90 and 90',
      });
    }

    if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
      errors.push({
        field: 'geolocation.longitude',
        message: 'longitude must be a number between -180 and 180',
      });
    }
  }
};

const normalizeQuantities = (quantities) => {
  const normalized = {};

  for (const category of HAND_CATEGORIES) {
    normalized[category] =
      quantities[category] ?? quantities[String(category)] ?? 0;
  }

  return normalized;
};

const validateSubmitLine = (req, res, next) => {
  const body = req.body || {};
  const errors = [];

  validateLineFields(body, errors);
  validateQuantities(body.quantities || {}, errors);

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = {
    brandName: body.brandName,
    vendorName: body.vendorName.trim(),
    farmerName: body.farmerName.trim(),
    supervisor: body.supervisor.trim(),
    lineNumber: body.lineNumber,
    weight: body.weight,
    address: body.address.trim(),
    packageDate: new Date(body.packageDate),
    geolocation: {
      latitude: body.geolocation.latitude,
      longitude: body.geolocation.longitude,
    },
    quantities: normalizeQuantities(body.quantities),
  };

  return next();
};

const validateResolveConflict = (req, res, next) => {
  const body = req.body || {};
  const errors = [];

  if (!isNonEmptyString(body.brandName) || !ALLOWED_BRANDS.includes(body.brandName)) {
    errors.push({
      field: 'brandName',
      message: `brandName must be one of: ${ALLOWED_BRANDS.join(', ')}`,
    });
  }

  if (!isValidISODate(body.packageDate)) {
    errors.push({
      field: 'packageDate',
      message: 'packageDate is required and must be a valid date',
    });
  }

  if (!Number.isInteger(body.lineNumber) || body.lineNumber < 1) {
    errors.push({
      field: 'lineNumber',
      message: 'lineNumber must be a natural number (positive integer)',
    });
  }

  if (!['reuse', 'update'].includes(body.action)) {
    errors.push({
      field: 'action',
      message: 'action must be either "reuse" or "update"',
    });
  }

  if (body.action === 'update') {
    if (typeof body.payload !== 'object' || body.payload === null) {
      errors.push({
        field: 'payload',
        message: 'payload is required when action is "update"',
      });
    } else {
      validateLineFields(
        {
          ...body.payload,
          brandName: body.brandName,
          packageDate: body.packageDate,
          lineNumber: body.lineNumber,
        },
        errors
      );
      validateQuantities(body.payload.quantities || {}, errors);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body = {
    brandName: body.brandName,
    packageDate: new Date(body.packageDate),
    lineNumber: body.lineNumber,
    action: body.action,
    payload:
      body.action === 'update'
        ? {
            vendorName: body.payload.vendorName.trim(),
            farmerName: body.payload.farmerName.trim(),
            supervisor: body.payload.supervisor.trim(),
            weight: body.payload.weight,
            address: body.payload.address.trim(),
            geolocation: {
              latitude: body.payload.geolocation.latitude,
              longitude: body.payload.geolocation.longitude,
            },
            quantities: normalizeQuantities(body.payload.quantities),
          }
        : null,
  };

  return next();
};

module.exports = {
  validateSubmitLine,
  validateResolveConflict,
  enforceSubadminPackageDate,
};
