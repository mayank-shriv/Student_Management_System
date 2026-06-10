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
import { redis, connectRedis, isRedisReady } from './config/redis.js';
import errorHandler from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import facultyRoutes from './routes/facultyRoutes.js';
import studentRoutes from './routes/studentRoutes.js';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com", "https://www.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com", "https://www.gstatic.com"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com", "https://www.gstatic.com"],
      frameSrc: ["https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "https://www.gstatic.com", "https://*.googleusercontent.com"],
      objectSrc: ["'none'"],
      childSrc: ["https://accounts.google.com"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
  credentials: true,
}));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan('combined', { stream: morganStream }));

const staticMaxAge = process.env.NODE_ENV === 'production' ? '7d' : '1d';
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: staticMaxAge,
  etag: true,
  lastModified: true,
}));

app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentRoutes);

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

app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ MySQL connected successfully');

    // Connect to Redis (non-blocking — app works without it)
    await connectRedis();

    const isDev = process.env.NODE_ENV !== 'production';
    try {
      await sequelize.sync(isDev ? { alter: true } : undefined);
      logger.info('✅ Database models synced');
    } catch (syncError) {
      // Print to console so nodemon shows full details
      console.error('Sequelize sync error:', syncError);
      if (syncError && syncError.stack) console.error(syncError.stack);
      // Log with winston (stringify nested properties)
      logger.error('❌ Sequelize sync failed: ' + (syncError && syncError.message ? syncError.message : String(syncError)));
      try {
        const details = {
          sql: syncError.sql || null,
          parent: syncError.parent ? { name: syncError.parent.name, message: syncError.parent.message } : null,
        };
        logger.error('Sync error details: ' + JSON.stringify(details));
      } catch (e) {
        logger.error('Failed to stringify syncError details');
      }
      throw syncError;
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`http://localhost:${PORT}`);
    });

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
          await redis.quit();
          logger.info('✅ Redis connection closed');
        } catch (err) {
          logger.error('Error closing Redis connection:', err.message);
        }

        logger.info('👋 Process terminated gracefully');
        process.exit(0);
      });

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
