const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const controller = require('./recovery.controller');
const {
  validateRecoverySheetId,
  validateRawRecoverySheetId,
  validateRecoveryLookupQuery,
} = require('./recovery.validation');

const router = express.Router();

// Recovery Sheet viewing is available to every authenticated role:
// Admin, Sub-Admin, Vendor, and Supervisor.
router.use(authMiddleware);

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
