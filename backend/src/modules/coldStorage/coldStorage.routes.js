const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./coldStorage.controller');
const {
  validateCreateColdStorage,
  validateUpdateColdStorage,
  validateColdStorageStatus,
} = require('./coldStorage.validation');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  authorize('admin', 'subadmin'),
  asyncHandler(controller.listColdStorages)
);

router.post(
  '/',
  authorize('admin'),
  validateCreateColdStorage,
  asyncHandler(controller.createColdStorage)
);

router.patch(
  '/:id/status',
  authorize('admin'),
  validateColdStorageStatus,
  asyncHandler(controller.updateColdStorageStatus)
);

router.patch(
  '/:id',
  authorize('admin'),
  validateUpdateColdStorage,
  asyncHandler(controller.updateColdStorage)
);

router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(controller.deleteColdStorage)
);

module.exports = router;
