const express = require('express');
const authMiddleware = require('../../middleware/auth.middleware');
const authorize = require('../../middleware/role.middleware');
const router = express.Router();
router.get('/dashboard', authMiddleware, authorize('vendor', 'admin'), (req, res) => {
  res.json({ success: true, message: 'Vendor portal access granted', user: req.user });
});
module.exports = router;
