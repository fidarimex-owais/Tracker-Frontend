// QR scanning route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./scanning.controller');
const {
  validateRecordId,
} = require('./scanning.validation');

// Create the QR scanning router

const router = express.Router();

/**
 * POST /api/scanning/qr
 *
 * Direct/manual lookup:
 *   { "_id": "<parent MongoDB document ObjectId>" }
 *
 * Raw value returned by the physical QR scanner:
 *   { "qrValue": "<parent MongoDB document ObjectId>" }
 *
 * The generated QR itself contains only the plain ObjectId string.
 * Both request forms resolve to the same parent record in qr_brand_details and
 * return the complete matching document.
 */
// Allow Admin and Sub-admin to scan and retrieve QR record data

router.post(
  '/qr',
  authMiddleware,
  authorize('admin', 'subadmin'),
  validateRecordId,
  asyncHandler(controller.scanQr)
);

// Export scanning router

module.exports = router;
