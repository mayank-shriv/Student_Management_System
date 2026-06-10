import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, Student, sequelize } from "../models/index.js";
import AppError from "../utils/AppError.js";
import { sendPasswordResetEmail } from "../utils/email.js";
import logger from "../config/logger.js";
import { storeRefreshToken, deleteRefreshToken, getRefreshToken, blacklistAccessToken, invalidateUserCache } from '../utils/tokenStore.js';

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || "15m";
const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || "7d";
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

export const durationToMs = (duration, fallbackMs) => {
  const match = /^(\d+)([smhd])$/.exec(duration || "");
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const signAccessToken = (id) => {
  return jwt.sign({ id }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRE,
  });
};

const signRefreshToken = (id) => {
  return jwt.sign({ id }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRE,
  });
};

export const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge,
    path: "/",
  };
};

const clearAuthCookies = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const expiredCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    expires: new Date(0),
    path: "/",
  };

  res.cookie(ACCESS_TOKEN_COOKIE, "", expiredCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, "", expiredCookieOptions);
};

export const issueTokens = async (user) => {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  user.refresh_token = hashToken(refreshToken);
  await user.save({ fields: ["refresh_token"] });

  // Store refresh token hash in Redis with TTL matching token expiry
  const refreshTtlMs = durationToMs(REFRESH_TOKEN_EXPIRE, 7 * 24 * 60 * 60 * 1000);
  await storeRefreshToken(user.id, hashToken(refreshToken), Math.floor(refreshTtlMs / 1000));

  return { accessToken, refreshToken };
};

const sendTokenResponse = async (user, statusCode, res) => {
  const { accessToken, refreshToken } = await issueTokens(user);
  const accessTokenMaxAge = durationToMs(ACCESS_TOKEN_EXPIRE, 15 * 60 * 1000);
  const refreshTokenMaxAge = durationToMs(
    REFRESH_TOKEN_EXPIRE,
    7 * 24 * 60 * 60 * 1000,
  );

  res.cookie(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    getCookieOptions(accessTokenMaxAge),
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    getCookieOptions(refreshTokenMaxAge),
  );

  res.status(statusCode).json({
    status: "success",
    data: {
      user: user.toSafeObject(),
    },
  });
};

export const register = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      name,
      email,
      password,
      role,
      enrollment_no,
      department,
      invite_code,
    } = req.body;

    if (role === "faculty") {
      const expectedCode = process.env.FACULTY_INVITE_CODE;
      if (!expectedCode || invite_code !== expectedCode) {
        throw new AppError("Invalid or missing faculty invite code.", 403);
      }
    }

    const existingUser = await User.findOne({
      where: { email },
      transaction: t,
    });
    if (existingUser) {
      throw new AppError("Email already registered.", 409);
    }

    const user = await User.create(
      { name, email, password, role },
      { transaction: t },
    );

    if (role === "student") {
      if (!enrollment_no) {
        throw new AppError("Enrollment number is required for students.", 400);
      }

      await Student.create(
        {
          user_id: user.id,
          enrollment_no,
          department: department || null,
        },
        { transaction: t },
      );
    }

    await t.commit();

    await sendTokenResponse(user, 201, res);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError("Invalid email or password.", 401);
    }

    if (!user.password) {
      throw new AppError(
        "This account uses Google Sign-In. Please use the Google button to log in.",
        401,
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError("Invalid email or password.", 401);
    }

    await sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new AppError("Refresh token missing. Please login again.", 401);
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.refresh_token) {
      clearAuthCookies(res);
      throw new AppError("Session expired. Please login again.", 401);
    }

    const hashedRefreshToken = hashToken(refreshToken);

    // Verify refresh token against Redis store too
    const storedHash = await getRefreshToken(decoded.id);
    if (storedHash && storedHash !== hashedRefreshToken) {
      await deleteRefreshToken(decoded.id);
      clearAuthCookies(res);
      throw new AppError('Refresh token reuse detected. Please login again.', 401);
    }

    if (user.refresh_token !== hashedRefreshToken) {
      user.refresh_token = null;
      await user.save({ fields: ["refresh_token"] });
      clearAuthCookies(res);
      throw new AppError("Invalid refresh token. Please login again.", 401);
    }

    await sendTokenResponse(user, 200, res);
  } catch (error) {
    clearAuthCookies(res);

    if (error.name === "JsonWebTokenError") {
      return next(
        new AppError("Invalid refresh token. Please login again.", 401),
      );
    }
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError("Refresh token expired. Please login again.", 401),
      );
    }
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        const user = await User.findByPk(decoded.id);

        if (user?.refresh_token === hashToken(refreshToken)) {
          user.refresh_token = null;
          await user.save({ fields: ["refresh_token"] });
          await deleteRefreshToken(decoded.id);
        }
      } catch (error) {}
    }

    // Blacklist the current access token for its remaining lifetime
    const accessToken = req.cookies?.access_token;
    if (accessToken) {
      try {
        const decoded_access = jwt.verify(accessToken, ACCESS_TOKEN_SECRET, { ignoreExpiration: true });
        const remainingTtl = decoded_access.exp - Math.floor(Date.now() / 1000);
        if (remainingTtl > 0) {
          await blacklistAccessToken(accessToken, remainingTtl);
        }
      } catch (e) {
        // Token already invalid, no need to blacklist
      }
    }

    clearAuthCookies(res);

    res.status(200).json({
      status: "success",
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    const data = {
      user: typeof user.toSafeObject === 'function'
        ? user.toSafeObject()
        : { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    };

    if (user.role === "student") {
      const studentProfile = await Student.findOne({
        where: { user_id: user.id },
        attributes: ["id", "enrollment_no", "department"],
      });
      data.studentProfile = studentProfile;
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(200).json({
        status: "success",
        message:
          "If an account with that email exists, a reset token has been generated.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashToken(resetToken);

    user.reset_token = hashedToken;
    user.reset_token_expires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ fields: ["reset_token", "reset_token_expires"] });

    const response = {
      status: "success",
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendPasswordResetEmail(user.email, resetToken);
        response.emailSent = true;
      } catch (emailError) {
        logger.error(
          "Failed to send reset email, falling back to token response:",
          emailError.message,
        );
      }
    } else {
      logger.warn(
        "SMTP not configured — returning reset token in response (dev mode).",
      );
    }

    if (process.env.NODE_ENV !== "production" && !response.emailSent) {
      response.resetToken = resetToken;
      response.resetUrl = `/reset-password?token=${resetToken}`;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      throw new AppError("Reset token is required.", 400);
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      where: {
        reset_token: hashedToken,
      },
    });

    if (!user) {
      throw new AppError("Invalid or expired reset token.", 400);
    }

    if (!user.reset_token_expires || user.reset_token_expires < new Date()) {
      user.reset_token = null;
      user.reset_token_expires = null;
      await user.save({ fields: ["reset_token", "reset_token_expires"] });
      throw new AppError(
        "Reset token has expired. Please request a new one.",
        400,
      );
    }

    user.password = password;
    user.reset_token = null;
    user.reset_token_expires = null;
    user.refresh_token = null;
    await user.save();

    await deleteRefreshToken(user.id);
    await invalidateUserCache(user.id);

    res.status(200).json({
      status: "success",
      message:
        "Password has been reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};
