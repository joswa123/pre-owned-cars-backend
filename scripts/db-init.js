// scripts/db-init.js
const dotenv = require('dotenv');
dotenv.config();

const { execSync } = require('child_process');
const sequelize = require('../src/config/database');
const seedAdmin = require('../src/utils/admin');
const seedLocations = require('../src/utils/seedLocations');

async function init() {
  try {
    console.log('🔄 Connecting to database: ' + process.env.DB_NAME + ' on ' + process.env.DB_HOST + '...');
    await sequelize.authenticate();
    console.log('✅ Connection has been established successfully.');

    console.log('🔄 Running database migrations...');
    try {
      execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
      console.log('✅ Database migrations completed.');
    } catch (migErr) {
      console.warn('⚠️ Migration warning (proceeding to sync):', migErr.message);
    }

    console.log('🔄 Syncing models (safe alter)...');
    try {
      const { Car } = require('../src/models');
      const carAttributes = Object.keys(Car.rawAttributes).map(
        (attr) => Car.rawAttributes[attr].field || attr
      );

      const [columns] = await sequelize.query(`
        SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cars';
      `);

      for (const col of columns) {
        if (!carAttributes.includes(col.COLUMN_NAME) && col.IS_NULLABLE === 'NO' && col.COLUMN_DEFAULT === null) {
          console.log(`🛠️ Fixing legacy NOT NULL column cars.${col.COLUMN_NAME}...`);
          try {
            // Drop FK on this column if any exists
            const [fks] = await sequelize.query(`
              SELECT CONSTRAINT_NAME 
              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
              WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'cars' 
                AND COLUMN_NAME = '${col.COLUMN_NAME}' 
                AND REFERENCED_TABLE_NAME IS NOT NULL;
            `);
            for (const fk of fks) {
              await sequelize.query(`ALTER TABLE cars DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\`;`);
            }

            await sequelize.query(`ALTER TABLE cars MODIFY COLUMN \`${col.COLUMN_NAME}\` VARCHAR(255) NULL DEFAULT NULL;`);
            console.log(`✅ cars.${col.COLUMN_NAME} changed to NULL DEFAULT NULL.`);
          } catch (alterErr) {
            console.warn(`Could not alter ${col.COLUMN_NAME}:`, alterErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Warning checking legacy columns:', e.message);
    }
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

    console.log('🔄 Checking / Seeding reference metadata (Body types, Fuel types, Transmissions)...');
    const seedReferenceData = require('../src/utils/seedReferenceData');
    await seedReferenceData();

    console.log('🎉 Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

init();
