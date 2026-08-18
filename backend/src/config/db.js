const mongoose = require('mongoose');

const connectDB = async () => {
  const connection = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB Connected: ${connection.connection.host}`);
  return connection;
};

module.exports = connectDB;
