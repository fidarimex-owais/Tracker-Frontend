const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const controller = require('./scanning.controller');
const {
  validateRecordId,
} = require('./scanning.validation');

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
router.post(
  '/qr',
  authMiddleware,
  validateRecordId,
  asyncHandler(controller.scanQr)
);

module.exports = router;
