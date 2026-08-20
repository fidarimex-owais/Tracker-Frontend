const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const adminController = require('../admin/admin.controller');

const router = express.Router();

router.use(
  authMiddleware,
  authorize('supervisor')
);

router.get(
  '/dashboard',
  asyncHandler(adminController.getDashboard)
);

module.exports = router;
