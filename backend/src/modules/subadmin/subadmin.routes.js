const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const adminController = require('../admin/admin.controller');

const router = express.Router();

router.use(authMiddleware, authorize('subadmin'));

router.get('/dashboard', (req, res) => {
  res.json({ success: true, message: 'Sub-Admin portal access granted', user: req.user });
});

router.get('/users', asyncHandler(adminController.listUsers));
router.patch('/users/:id/role', asyncHandler(adminController.updateRole));
router.patch('/users/:id/status', asyncHandler(adminController.updateStatus));

module.exports = router;
