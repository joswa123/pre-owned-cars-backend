// scripts/db-init.js
const dotenv = require('dotenv');
dotenv.config();

const sequelize = require('../src/config/database');
const seedAdmin = require('../src/utils/admin');
const seedLocations = require('../src/utils/seedLocations');

async function init() {
  try {
    console.log('🔄 Connecting to database: ' + process.env.DB_NAME + ' on ' + process.env.DB_HOST + '...');
    await sequelize.authenticate();
    console.log('✅ Connection has been established successfully.');

    console.log('🔄 Syncing models (safe alter)...');
    await sequelize.sync({ alter: true });
    console.log('✅ Models synced.');

    console.log('🔄 Checking / Seeding default admin user...');
    // Temp override of NODE_ENV if they explicitly run this script to ensure admin seeding can work
    const prevEnv = process.env.NODE_ENV;
    if (process.env.SEED_ADMIN_FORCE === 'true') {
      process.env.NODE_ENV = 'development';
    }
    await seedAdmin();
    process.env.NODE_ENV = prevEnv;

    console.log('🔄 Checking / Seeding default location data...');
    await seedLocations();

    console.log('🎉 Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

init();
