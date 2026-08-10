const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Middleware to check cache before hitting the database.
 * Use this on GET requests that benefit from caching.
 * @param {number} duration - Time to live in seconds
 */
const cacheMiddleware = (duration = 300, options = {}) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Construct cache key based on URL, query params, and authorization header (if not ignored)
    const authHeader = options.ignoreAuth ? '' : (req.headers.authorization || '');
    const key = `__express__${req.originalUrl || req.url}__${authHeader}`;

    try {
      if (!redisClient.isOpen) {
        // If Redis is not connected yet or down, bypass cache safely
        return next();
      }

      const cachedResponse = await redisClient.get(key);

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
              redisClient.setEx(key, duration, stringified).catch(err => {
                logger.error(`Redis cache set error: ${err.message}`);
              });
            } catch (e) {
              logger.error(`Cache serialization error: ${e.message}`);
            }
          }
          return originalJson(body);
        };
        next();
      }
    } catch (error) {
      logger.error(`Redis error in cacheMiddleware: ${error.message}`);
      // On error, just bypass cache
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

    // In Redis, we can use KEYS to find all matching keys.
    // For larger production datasets, SCAN is preferred over KEYS.
    const pattern = `__express__${prefix}*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
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
