import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './config/logger.js';
import { sequelize } from './models/index.js';
import errorHandler from './middleware/errorHandler.js';
import { getRedisClient, isRedisReady, disconnectRedis } from './config/redis.js';

import authRoutes from './routes/authRoutes.js';
import facultyRoutes from './routes/facultyRoutes.js';
import studentRoutes from './routes/studentRoutes.js';

// ---------------------------------------------------------------------------
// Environment validation — fail fast if critical secrets are missing rather
// than crashing later on the first request that needs them.
// ---------------------------------------------------------------------------
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    logger.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// In ES modules, __dirname is not available by default, so we recreate it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Helmet adds secure HTTP headers. Here we also define a CSP so only trusted
// sources can load styles, fonts, scripts, and images in the browser.
// Google Identity Services (GSI) requires script/frame/connect from accounts.google.com.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      // Allow the primary Google Identity origins used by GSI and related helpers.
      // Specifying the origin (accounts.google.com and apis.google.com) avoids
      // relying on a path-specific source which some browsers may not match.
      scriptSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com", "https://accounts.google.com/gsi/client"],
      frameSrc: ["https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
    },
  },
}));

// CORS allows the frontend to call this API and also enables cookies/auth data
// to be sent across origins when the frontend and backend run separately.
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
  credentials: true,
}));

// Gzip/Brotli compression reduces response sizes by 60-80% for JSON and HTML,
// significantly improving transfer speed for clients on slower connections.
app.use(compression());

// Body parsers and cookie parser make request payloads and cookies available
// on req.body and req.cookies for downstream route handlers.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Morgan captures HTTP request logs, and this custom stream forwards them into
// the central Winston logger so app logs and access logs stay consistent.
const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan('combined', { stream: morganStream }));

// Serves static frontend assets such as HTML, CSS, and client-side JS files.
// maxAge tells browsers to cache these assets, avoiding unnecessary re-downloads.
// In production we cache for 7 days; in development, 1 day.
const staticMaxAge = process.env.NODE_ENV === 'production' ? '7d' : '1d';
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: staticMaxAge,
  etag: true,
  lastModified: true,
}));

// Route modules keep the server entry point clean by grouping related endpoints
// by domain: authentication, faculty operations, and student operations.
app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentRoutes);

// Enhanced health-check endpoint — verifies database connectivity and reports
// runtime metrics so monitoring tools can detect issues early.
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'healthy',
      uptime: Math.round(process.uptime()),
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      },
      database: 'connected',
      redis: isRedisReady() ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      redis: isRedisReady() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// These routes return the main HTML pages for different parts of the app.
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/faculty', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'faculty.html'));
});
app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Any request that reaches this point did not match a valid route.
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Centralized error middleware ensures application errors are formatted in one place.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Startup is wrapped in an async function so the app only begins listening
// after database connectivity and model synchronization succeed.
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ MySQL connected successfully');

    // Initialize the Redis client — used for caching and rate limiting.
    getRedisClient();

    // In development, alter:true helps keep tables aligned with models.
    // In production, skipping that avoids risky automatic schema changes.
    const isDev = process.env.NODE_ENV !== 'production';
    await sequelize.sync(isDev ? { alter: true } : undefined);
    logger.info('✅ Database models synced');

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`http://localhost:${PORT}`);
    });

    // -----------------------------------------------------------------------
    // Graceful shutdown — when the process receives a termination signal (e.g.
    // during a deployment or container restart), we stop accepting new
    // connections, let in-flight requests finish, close the DB pool, and then
    // exit cleanly.  This prevents dropped requests and data corruption.
    // -----------------------------------------------------------------------
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('✅ HTTP server closed — no new connections accepted');

        try {
          await sequelize.close();
          logger.info('✅ Database connections closed');
        } catch (err) {
          logger.error('Error closing database connections:', err.message);
        }

        try {
          await disconnectRedis();
        } catch (err) {
          logger.error('Error closing Redis connection:', err.message);
        }

        logger.info('👋 Process terminated gracefully');
        process.exit(0);
      });

      // If the server hasn't finished closing within 10 seconds, force-kill
      // to avoid hanging deployments.
      setTimeout(() => {
        logger.error('⚠️  Graceful shutdown timed out — forcing exit');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
