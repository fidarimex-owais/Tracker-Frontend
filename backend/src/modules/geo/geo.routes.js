const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./geo.controller');

const router = express.Router();

router.use(
  authMiddleware,
  authorize('admin', 'subadmin')
);

router.get(
  '/autocomplete',
  asyncHandler(controller.autocomplete)
);

router.get(
  '/distance',
  asyncHandler(controller.distance)
);

module.exports = router;
