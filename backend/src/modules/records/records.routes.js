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

const router = express.Router();
router.use(authMiddleware, authorize('vendor', 'subadmin', 'admin'));
router.post(
  '/',
  enforceSubadminPackageDate,
  validateSubmitLine,
  asyncHandler(recordsController.createRecord)
);

router.post(
  '/resolve',
  enforceSubadminPackageDate,
  validateResolveConflict,
  asyncHandler(recordsController.resolveConflict)
);

router.get(
  '/download',
  enforceSubadminPackageDate,
  asyncHandler(recordsController.downloadZip)
);

router.get(
  '/print',
  enforceSubadminPackageDate,
  asyncHandler(recordsController.printPreview)
);
module.exports = router;
