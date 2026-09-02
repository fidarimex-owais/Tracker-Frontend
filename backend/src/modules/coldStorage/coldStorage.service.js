const mongoose = require('mongoose');
const { getColdStorageModel } = require('./coldStorage.model');
const {
  findActiveVendorById,
  listActiveVendors,
} = require('../auth/auth.model');

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const sanitizeColdStorage = (storage, vendorActive = true) => ({
  id: storage._id.toString(),
  name: storage.name,
  address: storage.address,
  location: {
    latitude: storage.location.latitude,
    longitude: storage.location.longitude,
    placeId: storage.location.placeId || '',
  },
  vendorId: storage.vendorId.toString(),
  vendorName: storage.vendorName,
  vendorCompanyName: storage.vendorCompanyName || '',
  vendorActive,
  isActive: storage.isActive,
  createdAt: storage.createdAt,
  updatedAt: storage.updatedAt,
});

const resolveActiveVendor = async (vendorId) => {
  const vendor = await findActiveVendorById(vendorId);

  if (!vendor) {
    throw createHttpError(400, 'Select an active Vendor');
  }

  return vendor;
};

const createColdStorage = async (payload, actor) => {
  const vendor = await resolveActiveVendor(payload.vendorId);
  const ColdStorage = getColdStorageModel();

  try {
    const storage = await ColdStorage.create({
      name: payload.name,
      normalizedName: normalizeName(payload.name),
      address: payload.address,
      location: payload.location,
      vendorId: vendor._id,
      vendorName: vendor.userName || vendor.email,
      vendorCompanyName: vendor.companyName || '',
      isActive: true,
      createdBy: mongoose.isValidObjectId(actor?.id) ? actor.id : null,
    });

    return sanitizeColdStorage(storage);
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(
        409,
        'A Cold Storage with this name already exists for the selected Vendor'
      );
    }
    throw error;
  }
};

const listColdStorages = async ({
  actorRole,
  includeInactive = false,
  vendorId = '',
} = {}) => {
  const ColdStorage = getColdStorageModel();
  const filter = {};

  const canIncludeInactive =
    actorRole === 'admin' && includeInactive === true;

  if (!canIncludeInactive) {
    filter.isActive = true;
  }

  if (vendorId) {
    if (!mongoose.isValidObjectId(vendorId)) {
      throw createHttpError(400, 'vendorId is invalid');
    }
    filter.vendorId = vendorId;
  }

  let activeVendorIds = null;

  if (!canIncludeInactive) {
    const activeVendors = await listActiveVendors();
    activeVendorIds = new Set(
      activeVendors.map((vendor) => vendor._id.toString())
    );

    if (vendorId && !activeVendorIds.has(vendorId)) {
      return [];
    }

    filter.vendorId = vendorId
      ? vendorId
      : { $in: [...activeVendorIds] };
  }

  const storages = await ColdStorage.find(filter)
    .sort({ isActive: -1, name: 1, createdAt: -1 })
    .lean();

  if (canIncludeInactive) {
    const activeVendors = await listActiveVendors();
    activeVendorIds = new Set(
      activeVendors.map((vendor) => vendor._id.toString())
    );
  }

  return storages.map((storage) =>
    sanitizeColdStorage(
      storage,
      activeVendorIds
        ? activeVendorIds.has(storage.vendorId.toString())
        : true
    )
  );
};

const findActiveColdStorageById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  return getColdStorageModel()
    .findOne({ _id: id, isActive: true })
    .lean();
};

const updateColdStorage = async (id, payload) => {
  if (!mongoose.isValidObjectId(id)) {
    throw createHttpError(404, 'Cold Storage not found');
  }

  const ColdStorage = getColdStorageModel();
  const storage = await ColdStorage.findById(id);

  if (!storage) {
    throw createHttpError(404, 'Cold Storage not found');
  }

  if (payload.vendorId !== undefined) {
    const vendor = await resolveActiveVendor(payload.vendorId);
    storage.vendorId = vendor._id;
    storage.vendorName = vendor.userName || vendor.email;
    storage.vendorCompanyName = vendor.companyName || '';
  }

  if (payload.name !== undefined) {
    storage.name = payload.name;
    storage.normalizedName = normalizeName(payload.name);
  }

  if (payload.address !== undefined) {
    storage.address = payload.address;
  }

  if (payload.location !== undefined) {
    storage.location = payload.location;
  }

  try {
    await storage.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(
        409,
        'A Cold Storage with this name already exists for the selected Vendor'
      );
    }
    throw error;
  }

  return sanitizeColdStorage(storage);
};

const updateColdStorageStatus = async (id, isActive) => {
  if (!mongoose.isValidObjectId(id)) {
    throw createHttpError(404, 'Cold Storage not found');
  }

  const ColdStorage = getColdStorageModel();
  const storage = await ColdStorage.findById(id);

  if (!storage) {
    throw createHttpError(404, 'Cold Storage not found');
  }

  if (isActive) {
    await resolveActiveVendor(storage.vendorId);
  }

  storage.isActive = isActive;
  await storage.save();

  return sanitizeColdStorage(storage, isActive);
};

const deleteColdStorage = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw createHttpError(404, 'Cold Storage not found');
  }

  const ColdStorage = getColdStorageModel();
  const result = await ColdStorage.findByIdAndDelete(id);

  if (!result) {
    throw createHttpError(404, 'Cold Storage not found');
  }
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  createColdStorage,
  listColdStorages,
  findActiveColdStorageById,
  updateColdStorage,
  updateColdStorageStatus,
  deleteColdStorage,
};
