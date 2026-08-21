const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const {
  loginRateLimiter,
  signupRateLimiter,
} = require('../../middleware/rateLimit.middleware');

const {
  validateCredentials,
  validateSignupRequest,
} = require('./auth.validation');

const controller = require('./auth.controller');

const router = express.Router();

router.post(
  '/signup',
  signupRateLimiter,
  validateSignupRequest,
  asyncHandler(controller.signup)
);

router.post(
  '/login',
  loginRateLimiter,
  validateCredentials,
  asyncHandler(controller.login)
);

router.post(
  '/logout',
  controller.logout
);

router.get(
  '/me',
  authMiddleware,
  asyncHandler(controller.me)
);

module.exports = router;