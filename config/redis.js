import Redis from 'ioredis';
import logger from './logger.js';

// ---------------------------------------------------------------------------
// Redis Client
// Provides a shared Redis connection and helper functions for caching.
// If Redis is unavailable the app degrades gracefully — cache misses simply
// fall through to the database so nothing breaks.
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;
let isReady = false;

/**
 * Lazily creates and returns the shared Redis client.
 * Calling this multiple times always returns the same instance.
 */
export const getRedisClient = () => {
  if (client) return client;

  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        // Stop retrying after 5 attempts — Redis is genuinely unavailable.
        logger.warn(
          '⚠️  Redis unavailable after 5 retries. Running without caching / Redis rate-limiting.'
        );
        return null;           // returning null stops reconnection
      }
      // Exponential back-off capped at 3 seconds.
      return Math.min(times * 200, 3000);
    },
    // Don't throw on connection errors — we handle them in event listeners.
    lazyConnect: false,
  });

  client.on('connect', () => {
    logger.info('✅ Redis connected');
  });

  client.on('ready', () => {
    isReady = true;
    logger.info('✅ Redis ready');
  });

  // Deduplicate noisy error/close logs so a single outage doesn't flood the console.
  let lastLoggedError = '';
  client.on('error', (err) => {
    isReady = false;
    const msg = err.message || err.code || String(err);
    if (msg !== lastLoggedError) {
      logger.error(`Redis error: ${msg}`);
      lastLoggedError = msg;
    }
  });

  client.on('close', () => {
    isReady = false;
    // Only log once — retryStrategy already logs when giving up.
  });

  return client;
};

/**
 * Returns true when the Redis connection is healthy and ready for commands.
 */
export const isRedisReady = () => isReady;

// ---------------------------------------------------------------------------
// Cache Helpers
// All helpers swallow errors so a Redis outage never crashes the app.
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached value.  Returns the parsed object or null on miss/error.
 */
export const getCache = async (key) => {
  try {
    if (!isReady) return null;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error(`Redis getCache error for key "${key}": ${err.message}`);
    return null;
  }
};

/**
 * Store a value in the cache with a TTL (in seconds).
 */
export const setCache = async (key, data, ttlSeconds = 300) => {
  try {
    if (!isReady) return;
    await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    logger.error(`Redis setCache error for key "${key}": ${err.message}`);
  }
};

/**
 * Delete a single cached key.
 */
export const delCache = async (key) => {
  try {
    if (!isReady) return;
    await client.del(key);
  } catch (err) {
    logger.error(`Redis delCache error for key "${key}": ${err.message}`);
  }
};

/**
 * Delete all keys matching a glob pattern (e.g. "dashboard:*").
 * Uses SCAN so it's safe on large key-spaces (never blocks with KEYS).
 */
export const delPattern = async (pattern) => {
  try {
    if (!isReady) return;
    const stream = client.scanStream({ match: pattern, count: 100 });
    const pipeline = client.pipeline();
    let count = 0;

    for await (const keys of stream) {
      for (const key of keys) {
        pipeline.del(key);
        count++;
      }
    }

    if (count > 0) {
      await pipeline.exec();
    }
  } catch (err) {
    logger.error(`Redis delPattern error for "${pattern}": ${err.message}`);
  }
};

/**
 * Gracefully close the Redis connection.
 */
export const disconnectRedis = async () => {
  try {
    if (client) {
      await client.quit();
      logger.info('✅ Redis connection closed');
    }
  } catch (err) {
    logger.error(`Redis disconnect error: ${err.message}`);
  }
};

export default getRedisClient;
