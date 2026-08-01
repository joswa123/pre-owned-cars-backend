const dotenv = require('dotenv');
dotenv.config({ override: true });

const app = require('./app');
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 5000;

// ─── Startup Sequence ────────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Verify DB connectivity
    logger.info('⏳ Connecting to database...');
    await sequelize.authenticate();
    logger.info('✅ Database connected successfully');

    // 2. Sync schema — never alter/force in production
    logger.info('⏳ Syncing database schema...');
    try {
      const isDev = process.env.NODE_ENV === 'development';
      await sequelize.sync(isDev ? { alter: true } : {});
      logger.info('✅ Database schema synced');
    } catch (syncErr) {
      logger.warn('⚠️  Database sync warning (safe to ignore in clustered setup):', syncErr.message);
    }

    // 3. Seed data
    if (process.env.NODE_ENV === 'development') {
      try {
        const seedAdmin = require('./utils/admin');
        await seedAdmin();
      } catch (seedErr) {
        logger.warn('⚠️  Admin seed failed (non-fatal):', seedErr.message);
      }
    }

    // Seed location reference data (states, districts, cities) if empty
    try {
      const seedLocations = require('./utils/seedLocations');
      await seedLocations();
    } catch (seedErr) {
      logger.warn('⚠️  Location seed failed (non-fatal):', seedErr.message);
    }
    // 3.5 Connect to Redis
    const redisClient = require('./config/redis');
    await redisClient.connect();

    // 4. Start HTTP server
    // Bind to 0.0.0.0 to accept connections from Docker network / Render
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      logger.info(`🆔 Process ID: ${process.pid}`);
    });

  } catch (err) {
    logger.error('❌ Startup failed:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
})();