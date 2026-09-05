const redisClient = require('../config/redis');
const logger = require('../utils/logger');

let isRedisDegraded = false;
let nextRedisProbeTime = 0;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30-second cooldown window

/**
 * Middleware to check cache before hitting the database.
 * Use this on GET requests that benefit from caching.
 * @param {number} duration - Time to live in seconds
 * @param {object} options - Cache options (e.g. ignoreAuth)
 */
const cacheMiddleware = (duration = 300, options = {}) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Circuit Breaker: If Redis is degraded, bypass unless cooldown elapsed for a probe
    if (isRedisDegraded) {
      if (Date.now() < nextRedisProbeTime) {
        return next();
      }
      // Cooldown elapsed: Allow this request through as a health probe
    }

    if (!redisClient.isOpen) {
      return next();
    }

    // Construct cache key based on URL, query params, and authorization header (if not ignored)
    const authHeader = options.ignoreAuth ? '' : (req.headers.authorization || '');
    const key = `__express__${req.originalUrl || req.url}__${authHeader}`;

    try {
      const cachedResponse = await redisClient.get(key);

      // Successful call: Reset circuit breaker if it was previously tripped
      if (isRedisDegraded) {
        isRedisDegraded = false;
        logger.info('✅ Redis cache connection restored. Circuit breaker reset.');
      }

      if (cachedResponse) {
        // Cache HIT
        return res.setHeader('Content-Type', 'application/json').send(cachedResponse);
      } else {
        // Cache MISS
        // Override res.json to capture the response body
        const originalJson = res.json.bind(res);
        res.json = (body) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const stringified = JSON.stringify(body);
              // Save to Redis with expiry (fire and forget)
              if (redisClient.isOpen && !isRedisDegraded) {
                redisClient.setEx(key, duration, stringified).catch(err => {
                  logger.warn(`Redis cache set warning: ${err.message}`);
                });
              }
            } catch (e) {
              logger.error(`Cache serialization error: ${e.message}`);
            }
          }
          return originalJson(body);
        };
        next();
      }
    } catch (error) {
      // Trip circuit breaker on error
      if (!isRedisDegraded) {
        isRedisDegraded = true;
        nextRedisProbeTime = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        logger.warn(`⚠️ Redis error in cacheMiddleware. Circuit breaker active for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s: ${error.message}`);
      } else {
        // Probe failed, extend cooldown
        nextRedisProbeTime = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      }
      // Bypass cache safely
      next();
    }
  };
};

/**
 * Utility to manually clear cache by key prefix.
 * @param {string} prefix 
 */
const clearCache = async (prefix) => {
  try {
    if (!redisClient.isOpen) return;

    const pattern = `__express__${prefix}*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys && keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared cache for pattern: ${pattern} (${keys.length} keys removed)`);
    } else {
      logger.info(`No cache keys found for pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error(`Failed to clear cache: ${error.message}`);
  }
};

module.exports = {
  cacheMiddleware,
  clearCache
};
