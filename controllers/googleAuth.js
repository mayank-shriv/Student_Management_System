import { OAuth2Client } from 'google-auth-library';
import { User, Student, sequelize } from '../models/index.js';
import AppError from '../utils/AppError.js';
import logger from '../config/logger.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};

export const googleLogin = async (req, res, next) => {
  try {
    const { credential, role, invite_code, enrollment_no, department } = req.body;

    if (!credential) {
      throw new AppError('Google credential token is required.', 400);
    }

    if (!GOOGLE_CLIENT_ID) {
      throw new AppError('Google OAuth is not configured on this server.', 500);
    }

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

    let user = await User.findOne({ where: { email } });

    if (user) {
      if (!user.google_id) {
        user.google_id = googleId;
        await user.save({ fields: ['google_id'] });
      }
    } else {
      if (!role) {
        throw new AppError('No account found with this email. Please register first.', 404);
      }

      if (!['student', 'faculty'].includes(role)) {
        throw new AppError('Role must be student or faculty.', 400);
      }

      if (role === 'faculty') {
        const expectedCode = process.env.FACULTY_INVITE_CODE;
        if (!expectedCode || invite_code !== expectedCode) {
          throw new AppError('Invalid or missing faculty invite code.', 403);
        }
      }

      const t = await sequelize.transaction();
      try {
        user = await User.create(
          { name: name || email.split('@')[0], email, google_id: googleId, role },
          { transaction: t }
        );

        if (role === 'student') {
          const enrollNo = enrollment_no || `G${Date.now().toString(36).toUpperCase()}`;
          await Student.create(
            { user_id: user.id, enrollment_no: enrollNo, department: department || null },
            { transaction: t }
          );
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    const { issueTokens, getCookieOptions, durationToMs } = await import('./authController.js');
    const { accessToken, refreshToken } = await issueTokens(user);

    const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';
    const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '7d';

    const accessTokenMaxAge = durationToMs(ACCESS_TOKEN_EXPIRE, 15 * 60 * 1000);
    const refreshTokenMaxAge = durationToMs(REFRESH_TOKEN_EXPIRE, 7 * 24 * 60 * 60 * 1000);

    res.cookie('access_token', accessToken, getCookieOptions(accessTokenMaxAge));
    res.cookie('refresh_token', refreshToken, getCookieOptions(refreshTokenMaxAge));

    res.status(200).json({
      status: 'success',
      data: { user: user.toSafeObject() },
    });
  } catch (error) {
    next(error);
  }
};
