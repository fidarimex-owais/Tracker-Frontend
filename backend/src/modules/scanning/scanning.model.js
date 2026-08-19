const mongoose = require('mongoose');
const {
  ALL_BRANDS,
  getModelForBrand,
} = require('../records/records.model');

/**
 * Search the existing qr_brand_details brand collections by the
 * parent/package MongoDB document _id.
 *
 * No separate scanner collection is created.
 */
const findRecordDocumentById = async (recordId) => {
  const objectId = new mongoose.Types.ObjectId(recordId);

  for (const brandName of ALL_BRANDS) {
    const Model = getModelForBrand(brandName);

    const document = await Model.findById(objectId).lean();

    if (document) {
      return {
        brandName,
        document,
      };
    }
  }

  return null;
};

module.exports = {
  findRecordDocumentById,
};
