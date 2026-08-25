// Authentication route dependencies

const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const {
  loginRateLimiter,
  signupRateLimiter,
} = require('../../middleware/rateLimit.middleware');

const {
  validateCredentials,
  validateGoogleCredentials,
  validateSignupRequest,
} = require('./auth.validation');

const controller = require('./auth.controller');

// Create authentication router

const router = express.Router();

// Public signup endpoint

router.post(
  '/signup',
  signupRateLimiter,
  validateSignupRequest,
  asyncHandler(controller.signup)
);

// Email and password login endpoint

router.post(
  '/login',
  loginRateLimiter,
  validateCredentials,
  asyncHandler(controller.login)
);

// Google Sign-In endpoint

router.post(
  '/google',
  loginRateLimiter,
  validateGoogleCredentials,
  asyncHandler(controller.googleLogin)
);

// Session logout and current-user endpoints

router.post('/logout', controller.logout);

router.get(
  '/me',
  authMiddleware,
  asyncHandler(controller.me)
);

// Export authentication routes

module.exports = router;
