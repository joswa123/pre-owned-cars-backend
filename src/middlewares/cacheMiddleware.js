const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Initialize cache
// stdTTL: default time to live in seconds.
// checkperiod: period in seconds for the automatic delete check interval.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Middleware to cache HTTP responses
 * @param {number} duration - Time to live in seconds
 */
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Construct cache key based on URL and query params
    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      // logger.info(`Cache HIT for ${key}`); // Optional log
      return res.json(cachedResponse);
    } else {
      // logger.info(`Cache MISS for ${key}`); // Optional log
      // Override res.json to capture the response body
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Cache the response body
        // Ensure we don't cache error responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(key, body, duration);
        }
        return originalJson(body);
      };
      next();
    }
  };
};

/**
 * Utility to manually clear cache by key prefix
 * @param {string} prefix 
 */
const clearCache = (prefix) => {
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => key.startsWith(`__express__${prefix}`));
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
    logger.info(`Cleared cache for keys starting with ${prefix}`);
  }
};

module.exports = {
  cacheMiddleware,
  clearCache,
  cache
};
