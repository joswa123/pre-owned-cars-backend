const dotenv = require('dotenv');
dotenv.config();

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
    await sequelize.sync({ alter: false, force: false });
    logger.info('✅ Database schema synced');

    // 3. Seed data — only in development; skipped on Render/production
    if (process.env.NODE_ENV === 'development') {
      try {
        const seedAdmin = require('./utils/admin');
        await seedAdmin();
      } catch (seedErr) {
        logger.warn('⚠️  Admin seed failed (non-fatal):', seedErr.message);
      }

      try {
        const seedLocations = require('./utils/seedLocations');
        await seedLocations();
      } catch (seedErr) {
        logger.warn('⚠️  Location seed failed (non-fatal):', seedErr.message);
      }
    }

    // 4. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

  } catch (err) {
    logger.error('❌ Startup failed:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
})();