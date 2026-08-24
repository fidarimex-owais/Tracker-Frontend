const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./qrBrandDetails.controller');

const router = express.Router();

router.use(authMiddleware, authorize('admin'));

router.get(
  '/options',
  asyncHandler(controller.listOptions)
);

router.delete(
  '/:packageId/lines/:lineId',
  asyncHandler(controller.deleteRecord)
);

router.get(
  '/',
  asyncHandler(controller.listDetails)
);

module.exports = router;
