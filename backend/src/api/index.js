const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const subadminRoutes = require('../modules/subadmin/subadmin.routes');
const vendorRoutes = require('../modules/vendor/vendor.routes');
const supervisorRoutes = require('../modules/supervisor/supervisor.routes');
const recordsRoutes = require('../modules/records/records.routes');
const scanningRoutes = require('../modules/scanning/scanning.routes');
const rawRecoveryRoutes = require('../modules/rawRecovery/rawRecovery.routes');
const recoveryRoutes = require('../modules/recovery/recovery.routes');
const qrBrandDetailsRoutes = require('../modules/qrBrandDetails/qrBrandDetails.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/sub-admin', subadminRoutes);
router.use('/vendor', vendorRoutes);
router.use('/supervisor', supervisorRoutes);
router.use('/records', recordsRoutes);
router.use('/scanning', scanningRoutes);
router.use('/raw-recovery-sheets', rawRecoveryRoutes);
router.use('/recovery-sheets', recoveryRoutes);
router.use('/qr-brand-details', qrBrandDetailsRoutes);

module.exports = router;
