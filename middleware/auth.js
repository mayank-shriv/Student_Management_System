import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { isTokenBlacklisted, getCachedUser, cacheUser } from '../utils/tokenStore.js';

const auth = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      throw new AppError('Not authenticated. Please login.', 401);
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);

    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw new AppError('Token has been revoked. Please login again.', 401);
    }

    const cachedUser = await getCachedUser(decoded.id);
    if (cachedUser) {
      req.user = cachedUser;
      next();
      return;
    }

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      throw new AppError('User no longer exists.', 401);
    }

    await cacheUser(user.id, user.toJSON());

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please login again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired. Please refresh your session.', 401));
    }
    next(error);
  }
};

export default auth;
