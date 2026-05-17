import { OAuth2Client } from 'google-auth-library';
import { User, Student, sequelize } from '../models/index.js';
import AppError from '../utils/AppError.js';
import logger from '../config/logger.js';
import { delPattern, setCache } from '../config/redis.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verifies a Google ID token and returns the user payload.
 * Throws if the token is invalid or wasn't issued for our client.
 */
const verifyGoogleToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

/**
 * POST /api/auth/google
 *
 * Accepts a Google ID token from the frontend, verifies it, and either:
 *   - Logs in the existing user (any page), or
 *   - Creates a new account with the given role (register page only).
 *
 * Body: { credential, role?, invite_code?, enrollment_no?, department? }
 *   - role: 'student' | 'faculty' (required for new user registration)
 *   - invite_code: required when role is 'faculty'
 *   - enrollment_no / department: optional student fields
 */
export const googleLogin = async (req, res, next) => {
  try {
    const { credential, role, invite_code, enrollment_no, department } = req.body;

    if (!credential) {
      throw new AppError('Google credential token is required.', 400);
    }

    if (!GOOGLE_CLIENT_ID) {
      throw new AppError('Google OAuth is not configured on this server.', 500);
    }

    // Verify the token with Google.
    let payload;
    try {
      payload = await verifyGoogleToken(credential);
    } catch (err) {
      logger.error(`Google token verification failed: ${err.message}`);
      throw new AppError('Invalid Google token. Please try again.', 401);
    }

    const { email, name, sub: googleId } = payload;

    if (!email) {
      throw new AppError('Unable to retrieve email from Google account.', 400);
    }

    // Check if a user with this email already exists.
    let user = await User.findOne({ where: { email } });

    if (user) {
      // Existing user — link Google ID if not already linked, then log in.
      if (!user.google_id) {
        user.google_id = googleId;
        await user.save({ fields: ['google_id'] });
      }
    } else {
      // New user — a role must be provided (from the register page).
      if (!role) {
        throw new AppError(
          'No account found with this email. Please register first.',
          404
        );
      }

      if (!['student', 'faculty'].includes(role)) {
        throw new AppError('Role must be student or faculty.', 400);
      }

      // Faculty registration requires a valid invite code.
      if (role === 'faculty') {
        const expectedCode = process.env.FACULTY_INVITE_CODE;
        if (!expectedCode || invite_code !== expectedCode) {
          throw new AppError('Invalid or missing faculty invite code.', 403);
        }
      }

      // Create the new user inside a transaction.
      const t = await sequelize.transaction();
      try {
        user = await User.create(
          {
            name: name || email.split('@')[0],
            email,
            google_id: googleId,
            role,
            // Password is null for Google-only accounts.
          },
          { transaction: t }
        );

        // Create a Student profile if the role is student.
        if (role === 'student') {
          const enrollNo =
            enrollment_no || `G${Date.now().toString(36).toUpperCase()}`;
          await Student.create(
            {
              user_id: user.id,
              enrollment_no: enrollNo,
              department: department || null,
            },
            { transaction: t }
          );
        }

        await t.commit();

        // Invalidate faculty students cache so the new student appears.
        if (role === 'student') {
          await delPattern('faculty:students:*');
        }
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    // Issue JWT tokens using the same logic as normal login.
    const { issueTokens, getCookieOptions, durationToMs } = await import('./authController.js');
    const { accessToken, refreshToken } = await issueTokens(user);

    const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';
    const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '7d';

    const accessTokenMaxAge = durationToMs(ACCESS_TOKEN_EXPIRE, 15 * 60 * 1000);
    const refreshTokenMaxAge = durationToMs(REFRESH_TOKEN_EXPIRE, 7 * 24 * 60 * 60 * 1000);

    res.cookie('access_token', accessToken, getCookieOptions(accessTokenMaxAge));
    res.cookie('refresh_token', refreshToken, getCookieOptions(refreshTokenMaxAge));

    // Cache the user for the auth middleware.
    const safeUser = user.toJSON();
    delete safeUser.password;
    await setCache(`user:${user.id}`, safeUser, 300);

    res.status(200).json({
      status: 'success',
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

