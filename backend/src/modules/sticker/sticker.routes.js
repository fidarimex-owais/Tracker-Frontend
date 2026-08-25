// Sticker route scaffold

const express = require('express');
const router = express.Router();

// Scaffold only. Existing /api/records/download and /api/records/print stay
// active for frontend compatibility; records.controller delegates here.
// Export sticker router

module.exports = router;
