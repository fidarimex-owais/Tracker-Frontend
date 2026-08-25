// Vendor route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const adminController = require('../admin/admin.controller');
const {
  validateCreateId,
} = require('../admin/admin.validation');

// Create the Vendor router

const router = express.Router();

// Protect Vendor routes with authentication and role authorization

router.use(
  authMiddleware,
  authorize('vendor')
);

// Vendor dashboard route

router.get(
  '/dashboard',
  asyncHandler(adminController.getDashboard)
);

// Create users permitted under the Vendor role

router.post(
  '/users',
  validateCreateId,
  asyncHandler(adminController.createUser)
);

// Signup request review routes

router.get(
  '/signup-requests/count',
  asyncHandler(adminController.getSignupRequestCount)
);

router.get(
  '/signup-requests',
  asyncHandler(adminController.listSignupRequests)
);

router.patch(
  '/signup-requests/:id/approve',
  asyncHandler(adminController.approveSignupRequest)
);

router.patch(
  '/signup-requests/:id/reject',
  asyncHandler(adminController.rejectSignupRequest)
);

// Vendor user-management routes

router.get(
  '/users',
  asyncHandler(adminController.listUsers)
);

router.patch(
  '/users/:id/status',
  asyncHandler(adminController.updateStatus)
);


// Delete users that the Vendor is permitted to manage

router.delete(
  '/users/:id',
  asyncHandler(adminController.deleteUser)
);

// Export Vendor router

module.exports = router;
