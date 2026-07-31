const { createClient } = require('redis');
const logger = require('../utils/logger');

// ─── Redis Connection ──────────────────────────────────────────────────────────
// In production (Render), we use Upstash Redis which requires:
//   - TLS (rediss://) instead of plain redis://
//   - A password for authentication
// In local Docker, we use plain redis:// with no password.
//
// Set these in your Render environment variables:
//   REDIS_HOST     = prime-wahoo-92459.upstash.io
//   REDIS_PORT     = 6379
//   REDIS_PASSWORD = <your Upstash password>

let redisUrl;

if (process.env.REDIS_PASSWORD) {
  // Production (Upstash) — use TLS with password
  redisUrl = `rediss://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
} else {
  // Local Docker — plain connection, no TLS, no password
  redisUrl = `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
}

const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
  // Log the error but don't crash — the app can run without Redis (cache will be bypassed)
  logger.error('❌ Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  logger.info('✅ Connected to Redis successfully');
});

module.exports = redisClient;
