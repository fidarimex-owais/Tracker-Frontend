const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const adminController = require('../admin/admin.controller');
const {
  validateCreateId,
} = require('../admin/admin.validation');

const router = express.Router();

router.use(
  authMiddleware,
  authorize('vendor')
);

router.get(
  '/dashboard',
  asyncHandler(adminController.getDashboard)
);

router.post(
  '/users',
  validateCreateId,
  asyncHandler(adminController.createUser)
);

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

router.get(
  '/users',
  asyncHandler(adminController.listUsers)
);

router.patch(
  '/users/:id/status',
  asyncHandler(adminController.updateStatus)
);


router.delete(
  '/users/:id',
  asyncHandler(adminController.deleteUser)
);

module.exports = router;
