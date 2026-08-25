// QR record route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const recordsController = require('./records.controller');
const {
  validateSubmitLine,
  validateResolveConflict,
  enforceSubadminPackageDate,
} = require('./records.validation');

// Create authenticated QR generation routes

const router = express.Router();
router.use(authMiddleware, authorize('vendor', 'subadmin', 'admin'));
// Create a new QR record line

router.post(
  '/',
  enforceSubadminPackageDate,
  validateSubmitLine,
  asyncHandler(recordsController.createRecord)
);

// Resolve an existing line-number conflict

router.post(
  '/resolve',
  enforceSubadminPackageDate,
  validateResolveConflict,
  asyncHandler(recordsController.resolveConflict)
);

// Download generated stickers

router.get(
  '/download',
  enforceSubadminPackageDate,
  asyncHandler(recordsController.downloadZip)
);

// Open the printable sticker preview

router.get(
  '/print',
  enforceSubadminPackageDate,
  asyncHandler(recordsController.printPreview)
);
// Export QR records router

module.exports = router;
