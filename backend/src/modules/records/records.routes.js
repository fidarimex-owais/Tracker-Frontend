const express = require('express');
const asyncHandler = require('../../middleware/async.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const recordsController = require('./records.controller');
const { validateSubmitLine, validateResolveConflict } = require('./records.validation');

const router = express.Router();
router.use(authMiddleware, authorize('vendor', 'subadmin', 'admin'));
router.post('/', validateSubmitLine, asyncHandler(recordsController.createRecord));
router.post('/resolve', validateResolveConflict, asyncHandler(recordsController.resolveConflict));
router.get('/download', asyncHandler(recordsController.downloadZip));
router.get('/print', asyncHandler(recordsController.printPreview));
module.exports = router;
