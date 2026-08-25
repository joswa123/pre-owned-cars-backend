const { Sequelize } = require('sequelize');
require('dotenv').config({ override: true });

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
const dbName = process.env.NODE_ENV === 'test'
  ? `${process.env.DB_NAME}_test`
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
      max: 4,
      min: 1,
      acquire: 30000,
      idle: 10000,
      evict: 1000,
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