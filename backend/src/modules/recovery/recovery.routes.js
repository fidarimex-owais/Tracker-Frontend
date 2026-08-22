const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./recovery.controller');
const {
  validateRecoverySheetId,
  validateRawRecoverySheetId,
  validateRecoveryLookupQuery,
} = require('./recovery.validation');

const router = express.Router();

// Recovery Sheet access: Admin, Sub-Admin and Vendor only.
// Vendor date filtering is additionally enforced in recovery.service.js.
router.use(
  authMiddleware,
  authorize('admin', 'subadmin', 'vendor')
);

router.get(
  '/options',
  asyncHandler(controller.listRecoverySheetOptions)
);

router.get(
  '/lookup',
  validateRecoveryLookupQuery,
  asyncHandler(controller.findRecoverySheet)
);

router.get(
  '/status/:rawSheetId',
  validateRawRecoverySheetId,
  asyncHandler(controller.getGenerationStatus)
);

router.post(
  '/generate/:rawSheetId',
  validateRawRecoverySheetId,
  asyncHandler(controller.generateRecoverySheet)
);

router.get(
  '/by-raw/:rawSheetId',
  validateRawRecoverySheetId,
  asyncHandler(controller.getRecoverySheetByRawId)
);

router.get(
  '/:id',
  validateRecoverySheetId,
  asyncHandler(controller.getRecoverySheet)
);

module.exports = router;
