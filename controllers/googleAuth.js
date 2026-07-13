import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';
import { User, Student } from '../models/index.js';
import AppError from '../utils/AppError.js';

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
      console.error(`Google token verification failed: ${err.message}`);
      throw new AppError('Invalid Google token. Please try again.', 401);
    }

    const { email, name, sub: googleId } = payload;

    if (!email) {
      throw new AppError('Unable to retrieve email from Google account.', 400);
    }

    let user = await User.findOne({ email });

    if (user) {
      // If a role was provided, the user is trying to register on the registration page,
      // but an account with this email already exists. We should block silent login.
      if (role) {
        throw new AppError('An account with this email already exists. Please log in instead.', 409);
      }

      if (!user.google_id) {
        // Auto-link Google to the existing password-registered account
        user.google_id = googleId;
        await user.save();
      } else if (user.google_id !== googleId) {
        // Existing Google ID doesn't match — different Google account
        throw new AppError('This email is linked to a different Google account.', 409);
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

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        user = new User({ name: name || email.split('@')[0], email, google_id: googleId, role });
        await user.save({ session });

        if (role === 'student') {
          if (!enrollment_no) {
            throw new AppError('Enrollment number is required for students.', 400);
          }
          const student = new Student({
            user_id: user._id,
            enrollment_no,
            department: department || null,
          });
          await student.save({ session });
        }

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
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
