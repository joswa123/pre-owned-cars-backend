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
    try {
      const isDev = process.env.NODE_ENV === 'development';
      await sequelize.sync(isDev ? { alter: true } : {});
      logger.info('✅ Database schema synced');
    } catch (syncErr) {
      logger.warn('⚠️  Database sync warning (safe to ignore in clustered setup):', syncErr.message);
    }

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
    // 3.5 Connect to Redis
    const redisClient = require('./config/redis');
    await redisClient.connect();

    // 4. Start HTTP server
    // ── Diagnostic Endpoints (used by Load Balancers & developers) ────────────

    // GET /health — Render and Nginx ping this to know if the instance is alive.
    // Returns 200 OK when the server is up and connected to the database.
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    });

    // GET /server-id — Tells you WHICH instance handled your request.
    // When running 3 replicas (Docker/Render), repeated calls will show
    // different PIDs/hostnames, confirming load-balancing is working.
    app.get('/server-id', (req, res) => {
      const os = require('os');
      res.status(200).json({
        pid:       process.pid,                           // Unique per process
        hostname:  os.hostname(),                         // Unique per container/instance
        env:       process.env.NODE_ENV || 'development',
        port:      PORT,
        timestamp: new Date().toISOString(),
      });
    });

    // Bind to 0.0.0.0 to accept connections from Docker network
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