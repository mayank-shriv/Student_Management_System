import { redis, isRedisReady } from "../config/redis.js";
import logger from "../config/logger.js";

/**
 * Returns Express middleware that caches JSON responses in Redis.
 *
 * @param {string} keyPrefix  Logical namespace (e.g. "students", "courses").
 * @param {number} ttlSeconds How long the cached entry lives.
 */
export function cacheMiddleware(keyPrefix, ttlSeconds) {
  return async (req, res, next) => {
    const cacheKey = `cache:${keyPrefix}:${req.originalUrl}`;

    // ── Try to serve from cache ────────────────────────────────────────────
    if (isRedisReady()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          res.set("X-Cache", "HIT");
          return res.json(JSON.parse(cached));
        }
      } catch (err) {
        logger.warn(`cacheMiddleware GET error: ${err.message}`);
      }
    }

    // ── Cache miss — intercept the outgoing response ───────────────────────
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      res.set("X-Cache", "MISS");

      // Fire-and-forget: store in Redis without blocking the response
      if (isRedisReady()) {
        redis
          .set(cacheKey, JSON.stringify(data), "EX", ttlSeconds)
          .catch((err) => {
            logger.warn(`cacheMiddleware SET error: ${err.message}`);
          });
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate all cache keys matching a glob pattern.
 *
 * @param {string} pattern  Glob-style pattern *without* the `cache:` prefix
 *                          (e.g. `"students:*"`).
 */
export async function invalidateCache(pattern) {
  if (!isRedisReady()) return;
  try {
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cache: invalidated ${keys.length} key(s) matching "cache:${pattern}"`);
    }
  } catch (err) {
    logger.warn(`invalidateCache error: ${err.message}`);
  }
}

/**
 * Delete one or more specific, fully-qualified cache keys.
 *
 * @param {...string} keys  Full cache keys to remove.
 */
export async function invalidateCacheKeys(...keys) {
  if (!isRedisReady() || keys.length === 0) return;
  try {
    await redis.del(...keys);
    logger.info(`Cache: deleted ${keys.length} explicit key(s)`);
  } catch (err) {
    logger.warn(`invalidateCacheKeys error: ${err.message}`);
  }
}
