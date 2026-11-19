const { Sequelize } = require('sequelize');
require('dotenv').config();

// ─── POLYFILL Sequelize.Op for v3 compatibility ─────────────────────────────
Sequelize.Op = {
  eq: '$eq', ne: '$ne', gte: '$gte', gt: '$gt', lte: '$lte', lt: '$lt',
  not: '$not', in: '$in', notIn: '$notIn', is: '$is', like: '$like',
  notLike: '$notLike', iLike: '$iLike', notILike: '$notILike',
  regexp: '$regexp', notRegexp: '$notRegexp', iRegexp: '$iRegexp',
  notIRegexp: '$notIRegexp', between: '$between', notBetween: '$notBetween',
  overlap: '$overlap', contains: '$contains', contained: '$contained',
  adjacent: '$adjacent', strictLeft: '$strictLeft', strictRight: '$strictRight',
  noExtendRight: '$noExtendRight', noExtendLeft: '$noExtendLeft',
  and: '$and', or: '$or', any: '$any', all: '$all', values: '$values',
  col: '$col'
};
// ────────────────────────────────────────────────────────────────────────────

// ─── Validate Required Environment Variables ───────────────────────────────────
const required = ['DB_NAME', 'DB_USER', 'DB_HOST'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    // Don't exit here — let server.js handle the failed authenticate()
  }
}

// ─── Dialect Options ──────────────────────────────────────────────────────────
// Enable SSL for production environments (Render, Railway, PlanetScale, etc.)
// Set DB_SSL=true in Render environment variables if your DB requires SSL.
const dialectOptions = {};
if (process.env.DB_SSL === 'true') {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false, // Required for self-signed certs (Render, Railway)
  };
}

// ─── Sequelize Instance ───────────────────────────────────────────────────────
const dbName = (process.env.NODE_ENV === 'test' && process.env.TEST_DB_NAME)
  ? process.env.TEST_DB_NAME
  : process.env.DB_NAME;

const sequelize = new Sequelize(
  dbName,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development'
      ? (msg) => console.log('[Sequelize]', msg)
      : false,
    dialectOptions,
    pool: {
      max: process.env.NODE_ENV === 'test' ? 5 : (parseInt(process.env.DB_POOL_MAX) || 5),
      min: process.env.NODE_ENV === 'test' ? 0 : (parseInt(process.env.DB_POOL_MIN) || 0),
      acquire: 30000,
      idle: 20000,
      evict: 10000,
    },
    retry: {
      max: 5,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /PROTOCOL_CONNECTION_LOST/,
        /PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR/,
        /Cannot enqueue Quit after fatal error/,
      ],
      backoffBase: 1000,
      backoffExponent: 1.5,
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  }
);

// Patch ConnectionManager to prevent "Cannot enqueue Quit after fatal error" unhandled rejections
// and ensure dead connections are properly validated before reuse.
if (sequelize.connectionManager) {
  const cm = sequelize.connectionManager;

  // 1. Safe disconnect: NEVER reject when destroying a connection from pool
  cm.disconnect = function (connection) {
    if (!connection) return Promise.resolve();

    // If protocol already ended or has fatal error, destroy the raw socket immediately without sending QUIT packet
    if (
      connection._protocol &&
      (connection._protocol._ended || connection._protocol._fatalError)
    ) {
      try {
        if (typeof connection.destroy === 'function') connection.destroy();
      } catch (_) {}
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        connection.end((err) => {
          if (err) {
            try {
              if (typeof connection.destroy === 'function') connection.destroy();
            } catch (_) {}
          }
          resolve(); // Always resolve, NEVER reject on pool disconnect
        });
      } catch (err) {
        try {
          if (typeof connection.destroy === 'function') connection.destroy();
        } catch (_) {}
        resolve();
      }
    });
  };

  // 2. Safe validate: correctly identify dead/fatal connections so pool discards them
  cm.validate = function (connection) {
    if (!connection) return false;
    if (['disconnected', 'protocol_error'].indexOf(connection.state) !== -1) return false;
    if (connection._fatalError) return false;
    if (connection._protocol && (connection._protocol._fatalError || connection._protocol._ended)) return false;
    if (connection._socket && (connection._socket.destroyed || !connection._socket.writable)) return false;
    return true;
  };
}

// Periodic keep-alive query to prevent connection drop / idle timeout on cloud providers
if (process.env.NODE_ENV !== 'test') {
  const keepAliveTimer = setInterval(async () => {
    try {
      await sequelize.query('SELECT 1');
    } catch (err) {
      // Periodic heartbeat failed; next query retry logic will re-establish connection
    }
  }, 30000);
  if (keepAliveTimer.unref) {
    keepAliveTimer.unref();
  }
}

module.exports = sequelize;