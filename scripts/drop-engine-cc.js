// scripts/drop-engine-cc.js
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

async function run() {
  console.log('🔄 Connecting to DB:', process.env.DB_NAME);
  await sequelize.authenticate();

  const queryInterface = sequelize.getQueryInterface();
  const tableDesc = await queryInterface.describeTable('cars');

  if (tableDesc.engine_cc) {
    console.log('❌ Dropping column engine_cc from cars table...');
    await sequelize.query('ALTER TABLE cars DROP COLUMN engine_cc;');
    console.log('  ✅ Column engine_cc successfully dropped from cars table.');
  } else {
    console.log('  ℹ️  Column engine_cc does not exist in cars table.');
  }

  await sequelize.close();
  console.log('🎉 Done!');
}

run().catch((err) => {
  console.error('❌ Error dropping engine_cc:', err.message);
  process.exit(1);
});
