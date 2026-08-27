const mongoose = require('mongoose');

const identityDocumentSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
    },
    assetId: {
      type: String,
      default: '',
    },
    resourceType: {
      type: String,
      default: 'image',
    },
    deliveryType: {
      type: String,
      default: 'authenticated',
    },
    format: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    bytes: {
      type: Number,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const identitySchema = new mongoose.Schema(
  {
    panEncrypted: {
      type: String,
      required: true,
    },
    aadhaarEncrypted: {
      type: String,
      required: true,
    },
    panVerification: {
      type: String,
      enum: ['format_verified'],
      default: 'format_verified',
    },
    aadhaarVerification: {
      type: String,
      enum: ['checksum_verified'],
      default: 'checksum_verified',
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    documents: {
      type: [identityDocumentSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

module.exports = {
  identitySchema,
};
