const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
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

// Barcode Scanner is available to every authenticated portal role.
// Saved-sheet Edit itself is restricted below to Admin and Sub-Admin.
router.use(
  authMiddleware,
  authorize('admin', 'subadmin', 'vendor', 'supervisor')
);

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

router.post(
  '/:id/rows',
  validateSheetId,
  asyncHandler(controller.addRow)
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

router.patch(
  '/:id/save',
  validateSheetId,
  asyncHandler(controller.saveSheet)
);

router.patch(
  '/:id/edit',
  authorize('admin', 'subadmin'),
  validateSheetId,
  asyncHandler(controller.editSheet)
);

router.patch(
  '/:id/rows/:rowNumber/reopen',
  validateSheetId,
  validateRowNumber,
  asyncHandler(controller.reopenRow)
);

router.delete(
  '/:id/rows/:rowNumber/barcodes/:barcodeId',
  validateSheetId,
  validateRowNumber,
  asyncHandler(controller.removeBarcode)
);

router.delete(
  '/:id/rows/:rowNumber',
  validateSheetId,
  validateRowNumber,
  asyncHandler(controller.removeRow)
);

module.exports = router;
