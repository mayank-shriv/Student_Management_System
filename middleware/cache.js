export function cacheMiddleware(keyPrefix, ttlSeconds) {
  return (req, res, next) => next();
}

export async function invalidateCache(pattern) {
  return;
}

export async function invalidateCacheKeys(...keys) {
  return;
}
