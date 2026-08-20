const mongoose = require('mongoose');

let brandDb = null;
let userDb = null;
let barcodeDb = null;
let rawRecoveryDb = null;
let recoveryDb = null;

const BRAND_DB_NAME = process.env.BRAND_DB_NAME || 'qr_brand_details';
const USER_DB_NAME = process.env.USER_DB_NAME || 'user_credentials';
const BARCODE_DB_NAME = process.env.BARCODE_DB_NAME || 'barcode_data';
const RAW_RECOVERY_DB_NAME =
  process.env.RAW_RECOVERY_DB_NAME || 'raw_recovery_sheet_structure';
const RECOVERY_DB_NAME =
  process.env.RECOVERY_DB_NAME || 'recovery_sheet_structure';

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  brandDb = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: BRAND_DB_NAME,
    })
    .asPromise();

  userDb = brandDb.useDb(USER_DB_NAME, {
    useCache: true,
  });

  barcodeDb = brandDb.useDb(BARCODE_DB_NAME, {
    useCache: true,
  });

  rawRecoveryDb = brandDb.useDb(RAW_RECOVERY_DB_NAME, {
    useCache: true,
  });

  recoveryDb = brandDb.useDb(RECOVERY_DB_NAME, {
    useCache: true,
  });

  console.log(`MongoDB Connected: ${brandDb.host}`);
  console.log(`Brand database: ${BRAND_DB_NAME}`);
  console.log(`User database: ${USER_DB_NAME}`);
  console.log(`Barcode database: ${BARCODE_DB_NAME}`);
  console.log(`Raw Recovery database: ${RAW_RECOVERY_DB_NAME}`);
  console.log(`Recovery Sheet database: ${RECOVERY_DB_NAME}`);

  return {
    brandDb,
    userDb,
    barcodeDb,
    rawRecoveryDb,
    recoveryDb,
  };
};

const getBrandDb = () => {
  if (!brandDb) {
    throw new Error(
      'Brand database is not initialized. Call connectDB() first.'
    );
  }

  return brandDb;
};

const getUserDb = () => {
  if (!userDb) {
    throw new Error(
      'User database is not initialized. Call connectDB() first.'
    );
  }

  return userDb;
};

const getBarcodeDb = () => {
  if (!barcodeDb) {
    throw new Error(
      'Barcode database is not initialized. Call connectDB() first.'
    );
  }

  return barcodeDb;
};

const getRawRecoveryDb = () => {
  if (!rawRecoveryDb) {
    throw new Error(
      'Raw Recovery database is not initialized. Call connectDB() first.'
    );
  }

  return rawRecoveryDb;
};

const getRecoveryDb = () => {
  if (!recoveryDb) {
    throw new Error(
      'Recovery Sheet database is not initialized. Call connectDB() first.'
    );
  }

  return recoveryDb;
};

module.exports = connectDB;

module.exports.connectDB = connectDB;
module.exports.getBrandDb = getBrandDb;
module.exports.getUserDb = getUserDb;
module.exports.getBarcodeDb = getBarcodeDb;
module.exports.getRawRecoveryDb = getRawRecoveryDb;
module.exports.getRecoveryDb = getRecoveryDb;
module.exports.BRAND_DB_NAME = BRAND_DB_NAME;
module.exports.USER_DB_NAME = USER_DB_NAME;
module.exports.BARCODE_DB_NAME = BARCODE_DB_NAME;
module.exports.RAW_RECOVERY_DB_NAME = RAW_RECOVERY_DB_NAME;
module.exports.RECOVERY_DB_NAME = RECOVERY_DB_NAME;
