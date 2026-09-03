const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 5000;

// ─── Database Connection with Exponential Backoff Retry ───────────────────
const connectWithRetry = async (maxRetries = 5, initialDelayMs = 1000) => {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`⏳ [Attempt ${attempt}/${maxRetries}] Connecting to database...`);
      await sequelize.authenticate();
      logger.info('✅ Database connected successfully');
      return;
    } catch (err) {
      logger.warn(`⚠️ DB connection failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2; // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    }
  }
};

// ─── Startup Sequence ────────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Verify DB connectivity with retry
    await connectWithRetry();

    // 2. We no longer sync schema automatically in production/development
    // to prevent accidental data wipes via alter: true.
    // Use `npm run db:migrate` for all schema changes!

    // 3. Seed data
    if (process.env.NODE_ENV === 'development') {
      try {
        const seedAdmin = require('./utils/admin');
        await seedAdmin();
      } catch (seedErr) {
        logger.warn('⚠️  Admin seed failed (non-fatal):', seedErr.message);
      }
    }

    // Auto-seeders for locations, reference data, and car catalog have been 
    // removed from server startup to drastically improve startup time.
    // They should now be executed explicitly via database migrations or CLI scripts.
    // 3.5 Connect to Redis
    const redisClient = require('./config/redis');
    try {
      await redisClient.connect();
    } catch (redisErr) {
      logger.warn('⚠️ Redis connection warning:', redisErr.message);
    }

    // 3.6 Start Analytics Metric Flusher (Configurable: default 15s interval)
    const analyticsService = require('./services/analyticsService');
    const metricFlushInterval = parseInt(process.env.METRIC_FLUSH_INTERVAL_MS) || 15000;
    const flusherInterval = setInterval(() => {
      analyticsService.flushMetricsToDb().catch(err => {
        logger.error('Background metric flush error:', err.message);
      });
    }, metricFlushInterval);
    logger.info(`⏱️ Analytics metric flusher active (Interval: ${metricFlushInterval / 1000}s)`);

    // 4. Start HTTP server
    // Bind to 0.0.0.0 to accept connections from Docker network / Render
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      logger.info(`🆔 Process ID: ${process.pid}`);
    });

    // 5. Zero-Leak Graceful Shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`🛑 ${signal} received. Starting graceful shutdown sequence...`);

      // Fallback safety timer (force exit after 10s if hanging)
      const forceExitTimer = setTimeout(() => {
        logger.error('⚠️ Graceful shutdown timed out (10s). Forcing process exit.');
        process.exit(1);
      }, 10000);
      if (forceExitTimer.unref) forceExitTimer.unref();

      // Stop analytics background flusher and flush remaining counts
      clearInterval(flusherInterval);
      try {
        await analyticsService.flushMetricsToDb();
        logger.info('✅ Live analytics metrics flushed.');
      } catch (e) {
        logger.warn('⚠️ Metrics flush on shutdown warning:', e.message);
      }

      // Stop accepting new HTTP requests
      server.close(async () => {
        logger.info('✅ HTTP server closed.');

        // Close Redis connection
        try {
          if (redisClient.isOpen) {
            await redisClient.quit();
            logger.info('✅ Redis connection closed.');
          }
        } catch (redisErr) {
          logger.warn('⚠️ Redis close warning:', redisErr.message);
        }

        // Close Sequelize MySQL pool
        try {
          await sequelize.close();
          logger.info('✅ Database connections closed.');
        } catch (dbErr) {
          logger.warn('⚠️ Database pool close warning:', dbErr.message);
        }

        clearTimeout(forceExitTimer);
        logger.info('🏁 Clean shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (err) {
    logger.error('❌ Startup failed:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
})();