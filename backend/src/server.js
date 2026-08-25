// DNS configuration for MongoDB Atlas

const dns = require('dns');

// Local Windows DNS can refuse MongoDB Atlas SRV lookups.
// Use Cloudflare DNS explicitly before Mongoose connects.
dns.setServers(['1.1.1.1', '1.0.0.1']);

// Load environment variables

require('dotenv').config();

// Application and database dependencies

const app = require('./app');
const connectDB = require('./config/db');
const { ensureAdminUser } = require('./modules/auth/auth.service');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB, ensure the Admin account exists, and start the server

const startServer = async () => {
  await connectDB();
  await ensureAdminUser();

  // 0.0.0.0 allows other devices on the same Wi-Fi (your phone)
  // to reach the backend using the PC's LAN IP.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Handle startup failures

startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
