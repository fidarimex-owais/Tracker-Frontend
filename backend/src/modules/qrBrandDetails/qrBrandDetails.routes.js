// QR Brand Details route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const controller = require('./qrBrandDetails.controller');

// Create Admin-only QR Brand Details routes

const router = express.Router();

router.use(authMiddleware, authorize('admin'));

// Provide filter option data

router.get(
  '/options',
  asyncHandler(controller.listOptions)
);

// Delete a selected QR record

router.delete(
  '/:packageId/lines/:lineId',
  asyncHandler(controller.deleteRecord)
);

// List QR Brand Details using optional filters

router.get(
  '/',
  asyncHandler(controller.listDetails)
);

// Export QR Brand Details router

module.exports = router;
