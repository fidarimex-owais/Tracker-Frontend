// Recovery Sheet route dependencies

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

// Create Recovery Sheet routes and apply portal permissions

const router = express.Router();

// Recovery Sheet access: Admin, Sub-Admin and Vendor only.
// Vendor date filtering is additionally enforced in recovery.service.js.
router.use(
  authMiddleware,
  authorize('admin', 'subadmin', 'vendor')
);

// List Recovery Sheets available to the current role

router.get(
  '/options',
  asyncHandler(controller.listRecoverySheetOptions)
);

// Find a Recovery Sheet by date, vendor and line

router.get(
  '/lookup',
  validateRecoveryLookupQuery,
  asyncHandler(controller.findRecoverySheet)
);

// Check whether a Raw Recovery Sheet can be generated

router.get(
  '/status/:rawSheetId',
  validateRawRecoverySheetId,
  asyncHandler(controller.getGenerationStatus)
);

// Generate a Recovery Sheet from completed Raw Recovery data

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

// Allow Admin to permanently delete a generated Recovery Sheet

router.delete(
  '/:id',
  authorize('admin'),
  validateRecoverySheetId,
  asyncHandler(controller.deleteRecoverySheet)
);

router.get(
  '/:id',
  validateRecoverySheetId,
  asyncHandler(controller.getRecoverySheet)
);

// Export Recovery Sheet router

module.exports = router;
