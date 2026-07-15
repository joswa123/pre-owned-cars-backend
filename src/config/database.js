const { Sequelize } = require('sequelize');
require('dotenv').config();

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
const sequelize = new Sequelize(
  process.env.DB_NAME,
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
      max: parseInt(process.env.DB_POOL_MAX) || (process.env.NODE_ENV === 'production' ? 5 : 10),
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  }
);

module.exports = sequelize;