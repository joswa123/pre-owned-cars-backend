// scripts/sync-car-schema-v2.js
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

async function run() {
  console.log('🔄 Connecting to DB:', process.env.DB_HOST, 'Database:', process.env.DB_NAME);
  await sequelize.authenticate();
  console.log('✅ DB Connection successful!');

  const queryInterface = sequelize.getQueryInterface();
  const tableDesc = await queryInterface.describeTable('cars');

  // 1. Add prior_appointemnts if missing
  if (!tableDesc.prior_appointemnts) {
    console.log('➕ Adding prior_appointemnts column...');
    await sequelize.query("ALTER TABLE cars ADD COLUMN prior_appointemnts INT DEFAULT 0;");
    console.log('  ✅ Added prior_appointemnts column.');
  } else {
    console.log('  ℹ️  prior_appointemnts column already exists.');
  }

  // Also safely add prior_appointments alias column if not existing for compatibility
  if (!tableDesc.prior_appointments) {
    console.log('➕ Adding prior_appointments column (alias)...');
    try {
      await sequelize.query("ALTER TABLE cars ADD COLUMN prior_appointments INT DEFAULT 0;");
      console.log('  ✅ Added prior_appointments column.');
    } catch (e) {
      console.log('  ℹ️  Note on prior_appointments:', e.message);
    }
  }

  // 2. Add color if missing
  if (!tableDesc.color) {
    console.log('➕ Adding color column...');
    await sequelize.query("ALTER TABLE cars ADD COLUMN color VARCHAR(50) NOT NULL DEFAULT '';");
    console.log('  ✅ Added color column.');
  } else {
    console.log('  ℹ️  color column already exists.');
  }

  // 3. Add number_plate if missing
  if (!tableDesc.number_plate) {
    console.log('➕ Adding number_plate column...');
    await sequelize.query("ALTER TABLE cars ADD COLUMN number_plate VARCHAR(50) NOT NULL DEFAULT '';");
    console.log('  ✅ Added number_plate column.');
  } else {
    console.log('  ℹ️  number_plate column already exists.');
  }

  // 4. Update existing records with default values if any are null
  console.log('\n🔄 Updating default values for existing car records...');
  await sequelize.query("UPDATE cars SET prior_appointemnts = 0 WHERE prior_appointemnts IS NULL;");
  try {
    await sequelize.query("UPDATE cars SET prior_appointments = 0 WHERE prior_appointments IS NULL;");
  } catch (e) {}
  await sequelize.query("UPDATE cars SET color = '' WHERE color IS NULL;");
  await sequelize.query("UPDATE cars SET number_plate = '' WHERE number_plate IS NULL;");
  console.log('  ✅ Default values updated for existing cars.');

  await sequelize.close();
  console.log('\n🎉 DB Schema Sync Completed Successfully!');
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
