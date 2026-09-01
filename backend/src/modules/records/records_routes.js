const express = require('express');
const router = express.Router();

const recordController = require('./records_controller');
const { validateSubmitLine, validateResolveConflict } = require('./records_validation');

router.post('/', validateSubmitLine, recordController.createRecord);
router.post('/resolve', validateResolveConflict, recordController.resolveConflict);
router.get('/download/:filename', recordController.downloadZip);

module.exports = router;