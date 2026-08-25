// Admin route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./admin.controller');
const {
  validateCreateId,
} = require('./admin.validation');

// Create the Admin router

const router = express.Router();

// Protect Admin routes with authentication and role authorization

router.use(
  authMiddleware,
  authorize('admin')
);

// Admin dashboard route

router.get(
  '/dashboard',
  asyncHandler(controller.getDashboard)
);

// User creation and account-management routes

router.post(
  '/users',
  validateCreateId,
  asyncHandler(controller.createUser)
);

router.get(
  '/active-ids',
  asyncHandler(controller.listActiveIds)
);

// Signup request review routes

router.get(
  '/signup-requests/count',
  asyncHandler(controller.getSignupRequestCount)
);

router.get(
  '/signup-requests',
  asyncHandler(controller.listSignupRequests)
);

router.patch(
  '/signup-requests/:id/approve',
  asyncHandler(controller.approveSignupRequest)
);

router.patch(
  '/signup-requests/:id/reject',
  asyncHandler(controller.rejectSignupRequest)
);

router.get(
  '/users',
  asyncHandler(controller.listUsers)
);

router.patch(
  '/users/:id/role',
  asyncHandler(controller.updateRole)
);

router.patch(
  '/users/:id/brand',
  asyncHandler(controller.updateBrand)
);

router.patch(
  '/users/:id/status',
  asyncHandler(controller.updateStatus)
);


// User deletion route

router.delete(
  '/users/:id',
  asyncHandler(controller.deleteUser)
);

// Export Admin routes

module.exports = router;
