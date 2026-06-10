import Redis from "ioredis";
import logger from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) {
      logger.error(
        `Redis: exceeded 10 reconnection attempts — giving up`,
      );
      return null;
    }
    const delay = Math.min(times * 200, 5000);
    logger.info(`Redis: retrying connection in ${delay}ms (attempt ${times})`);
    return delay;
  },
  lazyConnect: true,
});

// ── Event listeners ──────────────────────────────────────────────────────────

redis.on("connect", () => {
  logger.info("Redis: connection established");
});

redis.on("ready", () => {
  logger.info("Redis: client ready — accepting commands");
});

redis.on("error", (err) => {
  logger.error(`Redis: ${err.message}`);
});

redis.on("close", () => {
  logger.warn("Redis: connection closed");
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to connect to Redis.  Fail-open: logs a warning on failure but
 * does NOT throw, so the app can still start without Redis.
 */
async function connectRedis() {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn(`Redis: could not connect — ${err.message}`);
  }
}

/**
 * Returns `true` when the underlying connection is fully ready.
 */
function isRedisReady() {
  return redis.status === "ready";
}

export { redis, connectRedis, isRedisReady };
