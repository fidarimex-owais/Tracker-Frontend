const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRouter = require('./api');
const notFound = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const { apiRateLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

// Render/Railway and similar hosts sit behind a reverse proxy.
// Trust the first proxy so req.ip reflects the real client IP for rate limiting.
app.set('trust proxy', 1);
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'Server is running' }));
app.use('/api', apiRateLimiter, apiRouter);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
