const mongoose = require('mongoose');
const {
  ALL_BRANDS,
  getModelForBrand,
} = require('../records/records.model');
const {
  removeBarcodeLine,
  syncLineToBarcodeDatabase,
} = require('../barcode/barcode.service');

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeDateOnly = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) return '';

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
};

const dateRangeForDateOnly = (value) => {
  const normalized = normalizeDateOnly(value);

  if (!normalized) return null;

  const start = new Date(`${normalized}T00:00:00.000Z`);
  const end = new Date(`${normalized}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime())) return null;

  return { start, end };
};

const toDateOnly = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
};

const includesIgnoreCase = (value, searchValue) => {
  if (!searchValue) return true;

  return String(value || '')
    .toLowerCase()
    .includes(searchValue.toLowerCase());
};

const matchesObjectId = (value, searchValue) => {
  if (!searchValue) return true;

  return String(value || '').toLowerCase() === searchValue.toLowerCase();
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getRequestedBrands = (brandName) => {
  const requestedBrand = normalizeText(brandName);

  if (!requestedBrand) return ALL_BRANDS;

  if (!ALL_BRANDS.includes(requestedBrand)) {
    throw createHttpError(
      400,
      `Unknown brandName "${requestedBrand}". Must be one of: ${ALL_BRANDS.join(', ')}`
    );
  }

  return [requestedBrand];
};

const normalizeFilters = (query = {}) => ({
  packageDate: normalizeDateOnly(query.packageDate),
  brandName: normalizeText(query.brandName),
  supervisor: normalizeText(query.supervisor),
  lineNumber: normalizeText(query.lineNumber),
  vendorName: normalizeText(query.vendorName),
  qrCodeId: normalizeText(query.qrCodeId),
});

const lineMatches = ({ document, line, filters }) => {
  if (
    filters.lineNumber &&
    Number(line.lineNumber) !== Number(filters.lineNumber)
  ) {
    return false;
  }

  if (!includesIgnoreCase(line.vendorName, filters.vendorName)) {
    return false;
  }

  if (!includesIgnoreCase(line.supervisor, filters.supervisor)) {
    return false;
  }

  if (filters.qrCodeId) {
    const parentMatches = matchesObjectId(
      document._id,
      filters.qrCodeId
    );

    const nestedQrMatches = (line.qrCodes || []).some((qrCode) =>
      matchesObjectId(qrCode._id, filters.qrCodeId)
    );

    if (!parentMatches && !nestedQrMatches) {
      return false;
    }
  }

  return true;
};

const buildHandDetails = (line) => {
  const byHand = new Map(
    (line.qrCodes || []).map((qrCode) => [
      Number(qrCode.numberOfHands),
      Number(qrCode.quantity) || 0,
    ])
  );

  return [4, 5, 6, 8].map((numberOfHands) => ({
    numberOfHands,
    quantity: byHand.get(numberOfHands) || 0,
  }));
};

const flattenDocument = ({ document, brandName, filters }) => {
  const records = [];

  for (const line of document.lines || []) {
    if (!lineMatches({ document, line, filters })) {
      continue;
    }

    records.push({
      packageId: document._id.toString(),
      brandName,
      packageDate: toDateOnly(document.packageDate),
      lineId: line._id?.toString?.() || '',
      lineNumber: line.lineNumber,
      vendorName: line.vendorName,
      farmerName: line.farmerName,
      supervisor: line.supervisor,
      weight: line.weight,
      address: line.address,
      geolocation: line.geolocation
        ? {
            latitude: line.geolocation.latitude,
            longitude: line.geolocation.longitude,
          }
        : null,
      handDetails: buildHandDetails(line),
      totalQuantity: (line.qrCodes || []).reduce(
        (total, qrCode) => total + (Number(qrCode.quantity) || 0),
        0
      ),
      createdAt:
        line.createdAt ||
        line.createdDate ||
        document.createdAt ||
        null,
    });
  }

  return records;
};

const buildDocumentQuery = (filters) => {
  const query = {};

  const dateRange = dateRangeForDateOnly(filters.packageDate);

  if (dateRange) {
    query.packageDate = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  if (
    filters.qrCodeId &&
    mongoose.Types.ObjectId.isValid(filters.qrCodeId)
  ) {
    query.$or = [
      { _id: filters.qrCodeId },
      { 'lines.qrCodes._id': filters.qrCodeId },
    ];
  }

  if (filters.lineNumber) {
    query['lines.lineNumber'] = Number(filters.lineNumber);
  }

  if (filters.vendorName) {
    query['lines.vendorName'] = {
      $regex: escapeRegex(filters.vendorName),
      $options: 'i',
    };
  }

  if (filters.supervisor) {
    query['lines.supervisor'] = {
      $regex: escapeRegex(filters.supervisor),
      $options: 'i',
    };
  }

  return query;
};

const listDetails = async (query = {}) => {
  const filters = normalizeFilters(query);
  const brands = getRequestedBrands(filters.brandName);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE)
  );

  const records = [];

  for (const brandName of brands) {
    const Model = getModelForBrand(brandName);
    const documents = await Model.find(buildDocumentQuery(filters))
      .sort({ packageDate: -1, createdAt: -1 })
      .lean();

    for (const document of documents) {
      records.push(
        ...flattenDocument({
          document,
          brandName,
          filters,
        })
      );
    }
  }

  records.sort((left, right) => {
    const dateCompare = String(right.packageDate).localeCompare(
      String(left.packageDate)
    );

    if (dateCompare !== 0) return dateCompare;

    const brandCompare = left.brandName.localeCompare(right.brandName);
    if (brandCompare !== 0) return brandCompare;

    return Number(left.lineNumber) - Number(right.lineNumber);
  });

  const total = records.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;

  return {
    filters,
    pagination: {
      page: safePage,
      limit,
      total,
      pages,
      hasPrevious: safePage > 1,
      hasNext: safePage < pages,
    },
    rows: records.slice(start, start + limit),
  };
};

const listOptions = async (query = {}) => {
  const filters = normalizeFilters(query);
  const brands = getRequestedBrands(filters.brandName);

  const supervisors = new Set();
  const vendors = new Set();
  const lineNumbers = new Set();

  for (const brandName of brands) {
    const Model = getModelForBrand(brandName);
    const documentQuery = {};

    const dateRange = dateRangeForDateOnly(filters.packageDate);

    if (dateRange) {
      documentQuery.packageDate = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    }

    const documents = await Model.find(documentQuery)
      .select('lines.vendorName lines.supervisor lines.lineNumber')
      .lean();

    for (const document of documents) {
      for (const line of document.lines || []) {
        if (line.vendorName) vendors.add(line.vendorName);
        if (line.supervisor) supervisors.add(line.supervisor);
        if (line.lineNumber != null) {
          lineNumbers.add(Number(line.lineNumber));
        }
      }
    }
  }

  return {
    brands: ALL_BRANDS,
    vendors: [...vendors].sort((a, b) => a.localeCompare(b)),
    supervisors: [...supervisors].sort((a, b) => a.localeCompare(b)),
    lineNumbers: [...lineNumbers].sort((a, b) => a - b),
  };
};

const deleteRecord = async ({
  brandName,
  packageId,
  lineId,
}) => {
  if (!ALL_BRANDS.includes(brandName)) {
    throw createHttpError(400, 'Invalid brandName');
  }

  if (!mongoose.Types.ObjectId.isValid(packageId)) {
    throw createHttpError(400, 'Invalid packageId');
  }

  if (!mongoose.Types.ObjectId.isValid(lineId)) {
    throw createHttpError(400, 'Invalid lineId');
  }

  const Model = getModelForBrand(brandName);
  const document = await Model.findById(packageId);

  if (!document) {
    throw createHttpError(404, 'QR package record not found');
  }

  const line = document.lines.id(lineId);

  if (!line) {
    throw createHttpError(404, 'QR line record not found');
  }

  const lineSnapshot = line.toObject();
  const packageDate = document.packageDate;
  const vendorName = line.vendorName;
  const lineNumber = line.lineNumber;
  const sourceCollection = Model.collection.collectionName;

  // The line is mirrored in barcode_data. Remove that associated copy too.
  await removeBarcodeLine({
    packageDate,
    vendorName,
    lineNumber,
  });

  try {
    document.lines.pull(line._id);

    if (document.lines.length === 0) {
      await document.deleteOne();
    } else {
      await document.save();
    }
  } catch (error) {
    // Best-effort rollback of the barcode mirror if the QR database write fails.
    try {
      await syncLineToBarcodeDatabase({
        packageDate,
        vendorName,
        brandName,
        line: lineSnapshot,
        sourceCollection,
        sourcePackageId: document._id,
      });
    } catch (rollbackError) {
      // Keep the original deletion error as the surfaced failure.
    }

    throw error;
  }

  return {
    packageId: document._id.toString(),
    lineId: String(lineId),
    brandName,
    packageDeleted: document.lines.length === 0,
  };
};

module.exports = {
  listDetails,
  listOptions,
  deleteRecord,
};
