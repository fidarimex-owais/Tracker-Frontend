const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const controller = require('./rawRecovery.controller');
const {
  validateCreateSheet,
  validateSheetId,
  validateRowNumber,
  validateBarcodeScan,
  validateLookupQuery,
  validatePackagingDateQuery,
  validateLinesQuery,
} = require('./rawRecovery.validation');

const router = express.Router();

// No role restriction has been specified yet. Any authenticated user can use
// the Raw Recovery Sheet backend during this backend-only phase.
router.use(authMiddleware);

router.get(
  '/vendors',
  validatePackagingDateQuery,
  asyncHandler(controller.listVendors)
);

router.get(
  '/lines',
  validateLinesQuery,
  asyncHandler(controller.listLines)
);

router.get(
  '/lookup',
  validateLookupQuery,
  asyncHandler(controller.lookupSheet)
);

router.post(
  '/',
  validateCreateSheet,
  asyncHandler(controller.createSheet)
);

router.get(
  '/:id',
  validateSheetId,
  asyncHandler(controller.getSheet)
);

router.get(
  '/:id/rows/:rowNumber',
  validateSheetId,
  validateRowNumber,
  asyncHandler(controller.getRow)
);

router.post(
  '/:id/rows/:rowNumber/barcodes',
  validateSheetId,
  validateRowNumber,
  validateBarcodeScan,
  asyncHandler(controller.scanBarcode)
);

router.patch(
  '/:id/rows/:rowNumber/complete',
  validateSheetId,
  validateRowNumber,
  asyncHandler(controller.completeRow)
);

module.exports = router;
