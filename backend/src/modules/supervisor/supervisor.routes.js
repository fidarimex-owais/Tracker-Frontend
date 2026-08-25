// Supervisor route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const adminController = require('../admin/admin.controller');

// Create the Supervisor router

const router = express.Router();

// Protect Supervisor routes with authentication and role authorization

router.use(
  authMiddleware,
  authorize('supervisor')
);

// Supervisor dashboard route

router.get(
  '/dashboard',
  asyncHandler(adminController.getDashboard)
);

// Export Supervisor router

module.exports = router;
