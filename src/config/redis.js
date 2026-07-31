const { createClient } = require('redis');
const logger = require('../utils/logger');

// Setup Redis connection string
const host = process.env.REDIS_HOST || '127.0.0.1';
const port = process.env.REDIS_PORT || 6379;

const redisClient = createClient({
  url: `redis://${host}:${port}`
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('✅ Connected to Redis successfully');
});

module.exports = redisClient;
