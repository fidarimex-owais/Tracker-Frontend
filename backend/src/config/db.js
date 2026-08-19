const mongoose = require('mongoose');

let brandDb = null;
let userDb = null;
let barcodeDb = null;

const BRAND_DB_NAME = process.env.BRAND_DB_NAME || 'qr_brand_details';
const USER_DB_NAME = process.env.USER_DB_NAME || 'user_credentials';
const BARCODE_DB_NAME = process.env.BARCODE_DB_NAME || 'barcode_data';

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

  console.log(`MongoDB Connected: ${brandDb.host}`);
  console.log(`Brand database: ${BRAND_DB_NAME}`);
  console.log(`User database: ${USER_DB_NAME}`);
  console.log(`Barcode database: ${BARCODE_DB_NAME}`);

  return {
    brandDb,
    userDb,
    barcodeDb,
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

module.exports = connectDB;

module.exports.connectDB = connectDB;
module.exports.getBrandDb = getBrandDb;
module.exports.getUserDb = getUserDb;
module.exports.getBarcodeDb = getBarcodeDb;
module.exports.BRAND_DB_NAME = BRAND_DB_NAME;
module.exports.USER_DB_NAME = USER_DB_NAME;
module.exports.BARCODE_DB_NAME = BARCODE_DB_NAME;
