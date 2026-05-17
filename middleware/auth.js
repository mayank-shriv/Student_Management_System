import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { getCache, setCache } from '../config/redis.js';

const USER_CACHE_TTL = 300; // 5 minutes

const auth = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      throw new AppError('Not authenticated. Please login.', 401);
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);

    // Try Redis cache first to avoid a database round-trip on every request.
    const cacheKey = `user:${decoded.id}`;
    let userData = await getCache(cacheKey);

    let user;
    if (userData) {
      // Rebuild a lightweight User-like object from cache.  We attach the
      // real model's helper methods so downstream code works unchanged.
      user = User.build(userData, { isNewRecord: false });
    } else {
      user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        throw new AppError('User no longer exists.', 401);
      }

      // Cache the user (excluding password) for subsequent requests.
      await setCache(cacheKey, user.toJSON(), USER_CACHE_TTL);
    }

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
