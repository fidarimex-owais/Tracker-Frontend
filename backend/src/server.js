require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { ensureAdminUser } = require('./modules/auth/auth.service');

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  await connectDB();
  await ensureAdminUser();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};
startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
