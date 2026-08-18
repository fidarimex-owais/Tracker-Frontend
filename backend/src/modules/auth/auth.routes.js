const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const { validateCredentials } = require('./auth.validation');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/signup', validateCredentials, asyncHandler(controller.signup));
router.post('/login', validateCredentials, asyncHandler(controller.login));
router.post('/logout', controller.logout);
router.get('/me', authMiddleware, asyncHandler(controller.me));

module.exports = router;
