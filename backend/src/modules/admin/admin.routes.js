const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./admin.controller');

const {
  validateCreateId,
} = require('./admin.validation');

const router = express.Router();

router.use(
  authMiddleware,
  authorize('admin')
);

router.post(
  '/users',
  validateCreateId,
  asyncHandler(controller.createUser)
);

router.get(
  '/active-ids',
  asyncHandler(controller.listActiveIds)
);

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

// Existing user-management endpoints are kept for backward compatibility.
router.get(
  '/users',
  asyncHandler(controller.listUsers)
);

router.patch(
  '/users/:id/role',
  asyncHandler(controller.updateRole)
);

router.patch(
  '/users/:id/status',
  asyncHandler(controller.updateStatus)
);

module.exports = router;