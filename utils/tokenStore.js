import crypto from "node:crypto";
import { redis, isRedisReady } from "../config/redis.js";
import logger from "../config/logger.js";

// ── Internal helpers ─────────────────────────────────────────────────────────

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ── Refresh-token operations ─────────────────────────────────────────────────

/**
 * Store a hashed refresh token for a user with the given TTL.
 */
export async function storeRefreshToken(userId, tokenHash, ttlSeconds) {
  if (!isRedisReady()) return null;
  try {
    await redis.set(`refresh_token:${userId}`, tokenHash, "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`tokenStore.storeRefreshToken failed: ${err.message}`);
  }
}

/**
 * Retrieve the stored refresh-token hash for a user.
 */
export async function getRefreshToken(userId) {
  if (!isRedisReady()) return null;
  try {
    return await redis.get(`refresh_token:${userId}`);
  } catch (err) {
    logger.warn(`tokenStore.getRefreshToken failed: ${err.message}`);
    return null;
  }
}

/**
 * Remove the stored refresh token for a user (e.g. on logout).
 */
export async function deleteRefreshToken(userId) {
  if (!isRedisReady()) return null;
  try {
    await redis.del(`refresh_token:${userId}`);
  } catch (err) {
    logger.warn(`tokenStore.deleteRefreshToken failed: ${err.message}`);
  }
}

// ── Access-token blacklist ───────────────────────────────────────────────────

/**
 * Blacklist a JWT access token for the remainder of its natural TTL.
 * The token is stored by its SHA-256 hash to save memory.
 */
export async function blacklistAccessToken(token, remainingTtlSeconds) {
  if (!isRedisReady()) return null;
  try {
    const hash = sha256(token);
    await redis.set(`blacklist:${hash}`, "1", "EX", remainingTtlSeconds);
  } catch (err) {
    logger.warn(`tokenStore.blacklistAccessToken failed: ${err.message}`);
  }
}

/**
 * Check whether a JWT access token has been blacklisted.
 * Returns `false` if Redis is unavailable (fail-open).
 */
export async function isTokenBlacklisted(token) {
  if (!isRedisReady()) return false;
  try {
    const hash = sha256(token);
    const exists = await redis.exists(`blacklist:${hash}`);
    return exists === 1;
  } catch (err) {
    logger.warn(`tokenStore.isTokenBlacklisted failed: ${err.message}`);
    return false;
  }
}

// ── User cache ───────────────────────────────────────────────────────────────

/**
 * Cache serialised user data with a default TTL of 5 minutes.
 */
export async function cacheUser(userId, userData, ttlSeconds = 300) {
  if (!isRedisReady()) return null;
  try {
    await redis.set(
      `user:${userId}`,
      JSON.stringify(userData),
      "EX",
      ttlSeconds,
    );
  } catch (err) {
    logger.warn(`tokenStore.cacheUser failed: ${err.message}`);
  }
}

/**
 * Retrieve a cached user object, or `null` on miss / error.
 */
export async function getCachedUser(userId) {
  if (!isRedisReady()) return null;
  try {
    const data = await redis.get(`user:${userId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn(`tokenStore.getCachedUser failed: ${err.message}`);
    return null;
  }
}

/**
 * Remove a cached user entry (e.g. after profile update).
 */
export async function invalidateUserCache(userId) {
  if (!isRedisReady()) return null;
  try {
    await redis.del(`user:${userId}`);
  } catch (err) {
    logger.warn(`tokenStore.invalidateUserCache failed: ${err.message}`);
  }
}
