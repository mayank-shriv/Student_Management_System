import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './config/logger.js';
import { sequelize } from './models/index.js';
import errorHandler from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import facultyRoutes from './routes/facultyRoutes.js';
import studentRoutes from './routes/studentRoutes.js';

// In ES modules, __dirname is not available by default, so we recreate it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Helmet adds secure HTTP headers. Here we also define a CSP so only trusted
// sources can load styles, fonts, scripts, and images in the browser.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// CORS allows the frontend to call this API and also enables cookies/auth data
// to be sent across origins when the frontend and backend run separately.
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
  credentials: true,
}));

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
app.use(express.static(path.join(__dirname, 'public')));

// Route modules keep the server entry point clean by grouping related endpoints
// by domain: authentication, faculty operations, and student operations.
app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentRoutes);

// Simple health-check endpoint used to verify that the server is alive.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
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

    // In development, alter:true helps keep tables aligned with models.
    // In production, skipping that avoids risky automatic schema changes.
    const isDev = process.env.NODE_ENV !== 'production';
    await sequelize.sync(isDev ? { alter: true } : undefined);
    logger.info('✅ Database models synced');

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`http://localhost:${PORT}`)
    });
  } catch (error) {
    logger.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
