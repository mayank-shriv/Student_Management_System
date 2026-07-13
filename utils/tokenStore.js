import crypto from "node:crypto";

export async function storeRefreshToken(userId, tokenHash, ttlSeconds) {
  return null;
}

export async function getRefreshToken(userId) {
  return null;
}

export async function deleteRefreshToken(userId) {
  return null;
}

export async function blacklistAccessToken(token, remainingTtlSeconds) {
  return null;
}

export async function isTokenBlacklisted(token) {
  return false;
}

export async function cacheUser(userId, userData, ttlSeconds = 300) {
  return null;
}

export async function getCachedUser(userId) {
  return null;
}

export async function invalidateUserCache(userId) {
  return null;
}
