const express = require('express');
const cors = require('cors');

const app = express();

// ----- Core middleware -----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----- Routes -----
const recordRoutes = require('./src/modules/records/records_routes');
app.use('/api/records', recordRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// ----- 404 handler -----
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ----- Global error handler -----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;