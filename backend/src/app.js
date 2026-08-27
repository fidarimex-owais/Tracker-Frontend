// Core dependencies and middleware

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRouter = require('./api');
const notFound = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const { apiRateLimiter } = require('./middleware/rateLimit.middleware');

// Create the Express application

const app = express();

// Render/Railway and similar hosts sit behind a reverse proxy.
// Trust the first proxy so req.ip reflects the real client IP for rate limiting.

app.set('trust proxy', 1);


// Configure the frontend origins allowed by CORS

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {

      // Allow requests without an Origin header (Postman/Thunder/etc.)
      
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

// Parse cookies and incoming request bodies

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Server health-check endpoint

app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'Server is running' }));

// Mount application API routes with rate limiting

app.use('/api', apiRateLimiter, apiRouter);

// Handle unknown routes and application errors

app.use(notFound);
app.use(errorHandler);
module.exports = app;
