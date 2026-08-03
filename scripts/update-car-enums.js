// scripts/update-car-enums.js
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');
const seedReferenceData = require('../src/utils/seedReferenceData');

async function run() {
  await sequelize.authenticate();
  console.log('✅ Connected to DB:', process.env.DB_NAME);

  console.log('\n🔄 Updating fuel_type and transmission ENUMs on cars & variants tables...');

  try {
    const isPostgres = sequelize.getDialect() === 'postgres';

    if (isPostgres) {
      // Postgres enum alterations
      console.log('  ℹ️ Postgres dialect detected. Syncing schema...');
      await sequelize.sync({ alter: true });
    } else {
      // MySQL enum alterations
      await sequelize.query(
        "ALTER TABLE cars MODIFY COLUMN fuel_type ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG') NOT NULL;"
      );
      console.log('  ✅ Updated cars.fuel_type ENUM (added LPG)');

      await sequelize.query(
        "ALTER TABLE cars MODIFY COLUMN transmission ENUM('Manual', 'Automatic', 'AMT', 'CVT', 'DCT') NOT NULL;"
      );
      console.log('  ✅ Updated cars.transmission ENUM (added AMT)');

      await sequelize.query(
        "ALTER TABLE variants MODIFY COLUMN fuel_type ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG') NULL;"
      );
      console.log('  ✅ Updated variants.fuel_type ENUM (added LPG)');

      await sequelize.query(
        "ALTER TABLE variants MODIFY COLUMN transmission ENUM('Manual', 'Automatic', 'AMT', 'CVT', 'DCT') NULL;"
      );
      console.log('  ✅ Updated variants.transmission ENUM (added AMT)');

      await sequelize.query(
        "ALTER TABLE fuel_types MODIFY COLUMN user_id CHAR(36) BINARY NULL DEFAULT NULL;"
      );
      console.log('  ✅ Updated fuel_types.user_id to NULL DEFAULT NULL');

      await sequelize.query(
        "ALTER TABLE transmissions MODIFY COLUMN user_id CHAR(36) BINARY NULL DEFAULT NULL;"
      );
      console.log('  ✅ Updated transmissions.user_id to NULL DEFAULT NULL');
    }
  } catch (e) {
    console.log('  ⚠️ Warning updating DB column ENUMs:', e.message);
  }

  console.log('\n🔄 Seeding reference metadata (Body Types, Fuel Types, Transmissions)...');
  await seedReferenceData();

  await sequelize.close();
  console.log('\n🎉 ENUM and reference metadata update complete!');
}

run().catch((err) => {
  console.error('❌ Update script failed:', err.message);
  process.exit(1);
});
