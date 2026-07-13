import express from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { googleLogin } from '../controllers/googleAuth.js';
import validate from '../middleware/validate.js';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    status: 'fail',
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
      .trim()
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/\d/).withMessage('Password must contain a number'),
    body('role')
      .isIn(['faculty', 'student']).withMessage('Role must be faculty or student'),
    body('enrollment_no')
      .if(body('role').equals('student'))
      .trim()
      .notEmpty().withMessage('Enrollment number is required for students'),
    validate,
  ],
  authController.register
);

router.post(
  '/login',
  loginLimiter,
  [
    body('email')
      .trim()
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.login
);

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    status: 'fail',
    message: 'Too many password reset requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [
    body('email')
      .trim()
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    validate,
  ],
  authController.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token')
      .trim()
      .notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/\d/).withMessage('Password must contain a number'),
    validate,
  ],
  authController.resetPassword
);

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    status: 'fail',
    message: 'Too many refresh requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const logoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: 'fail',
    message: 'Too many logout requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', logoutLimiter, authController.logout);

router.get('/me', auth, authController.getMe);

router.post(
  '/google',
  [
    body('credential')
      .trim()
      .notEmpty().withMessage('Google credential token is required'),
    validate,
  ],
  googleLogin
);

router.get('/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

export default router;
