const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./admin.controller');

const router = express.Router();
router.use(authMiddleware, authorize('admin'));
router.get('/users', asyncHandler(controller.listUsers));
router.patch('/users/:id/role', asyncHandler(controller.updateRole));
router.patch('/users/:id/status', asyncHandler(controller.updateStatus));
module.exports = router;
