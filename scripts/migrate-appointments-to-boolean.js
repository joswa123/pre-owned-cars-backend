// scripts/migrate-appointments-to-boolean.js
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

async function run() {
  console.log('🔄 Connecting to DB:', process.env.DB_NAME);
  await sequelize.authenticate();

  console.log('🔄 Modifying prior_appointemnts column to TINYINT(1) / BOOLEAN...');
  try {
    await sequelize.query("ALTER TABLE cars MODIFY COLUMN prior_appointemnts TINYINT(1) NOT NULL DEFAULT 0;");
    console.log('  ✅ Column prior_appointemnts updated to TINYINT(1) / BOOLEAN.');
  } catch (e) {
    console.log('  ⚠️ error updating prior_appointemnts:', e.message);
  }

  try {
    await sequelize.query("ALTER TABLE cars MODIFY COLUMN prior_appointments TINYINT(1) NOT NULL DEFAULT 0;");
    console.log('  ✅ Column prior_appointments updated to TINYINT(1) / BOOLEAN.');
  } catch (e) {
    console.log('  ℹ️ Note on prior_appointments:', e.message);
  }

  // Ensure default value is false (0) for existing records
  await sequelize.query("UPDATE cars SET prior_appointemnts = 0 WHERE prior_appointemnts IS NULL;");
  try {
    await sequelize.query("UPDATE cars SET prior_appointments = 0 WHERE prior_appointments IS NULL;");
  } catch (e) {}

  await sequelize.close();
  console.log('🎉 Migration completed successfully!');
}

run().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
