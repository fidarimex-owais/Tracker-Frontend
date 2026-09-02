const mongoose = require('mongoose');

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeLocation = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const placeId = normalizeText(value.placeId);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    placeId,
  };
};

const validateColdStoragePayload = ({ partial = false } = {}) =>
  (req, res, next) => {
    const body = req.body || {};
    const errors = [];
    const output = {};

    if (!partial || body.name !== undefined) {
      const name = normalizeText(body.name);
      if (name.length < 2 || name.length > 120) {
        errors.push({
          field: 'name',
          message: 'Cold Storage Name must be 2 to 120 characters',
        });
      } else {
        output.name = name;
      }
    }

    if (!partial || body.vendorId !== undefined) {
      const vendorId = normalizeText(body.vendorId);
      if (!mongoose.isValidObjectId(vendorId)) {
        errors.push({
          field: 'vendorId',
          message: 'Select an active Vendor',
        });
      } else {
        output.vendorId = vendorId;
      }
    }

    if (!partial || body.address !== undefined) {
      const address = normalizeText(body.address);
      if (address.length < 3 || address.length > 500) {
        errors.push({
          field: 'address',
          message: 'Select a valid Cold Storage address/location',
        });
      } else {
        output.address = address;
      }
    }

    if (!partial || body.location !== undefined) {
      const location = normalizeLocation(body.location);
      if (!location) {
        errors.push({
          field: 'location',
          message: 'Select an address suggestion so coordinates are available',
        });
      } else {
        output.location = location;
      }
    }

    if (
      partial &&
      ((body.address !== undefined && body.location === undefined) ||
        (body.address === undefined && body.location !== undefined))
    ) {
      errors.push({
        field: 'address',
        message: 'Address and location coordinates must be updated together',
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    req.body = partial
      ? { ...body, ...output }
      : output;

    return next();
  };

const validateCreateColdStorage = validateColdStoragePayload();
const validateUpdateColdStorage = validateColdStoragePayload({ partial: true });

const validateColdStorageStatus = (req, res, next) => {
  if (typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isActive must be true or false',
      errors: [
        {
          field: 'isActive',
          message: 'isActive must be true or false',
        },
      ],
    });
  }

  req.body = { isActive: req.body.isActive };
  return next();
};

module.exports = {
  validateCreateColdStorage,
  validateUpdateColdStorage,
  validateColdStorageStatus,
};
