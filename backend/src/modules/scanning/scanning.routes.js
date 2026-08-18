const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./scanning.controller');

const router = express.Router();
router.get('/resolve', authMiddleware, authorize('supervisor', 'subadmin', 'admin'), asyncHandler(controller.resolveCode));
module.exports = router;
