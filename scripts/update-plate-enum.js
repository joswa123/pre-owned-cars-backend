// scripts/update-plate-enum.js
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

async function run() {
  await sequelize.authenticate();
  console.log('✅ Connected to DB:', process.env.DB_NAME);

  console.log('\n🔄 Updating number_plate_color ENUM...');

  try {
    // 1. Temporarily change the column to VARCHAR to avoid ENUM truncation during update
    await sequelize.query("ALTER TABLE cars MODIFY COLUMN number_plate_color VARCHAR(50) NOT NULL DEFAULT 'Own Board';");
    console.log('  ✅ Changed column to VARCHAR temporarily');

    // 2. Update existing rows to a valid new option
    await sequelize.query("UPDATE cars SET number_plate_color = 'Own Board' WHERE number_plate_color NOT IN ('Own Board', 'T-Board', 'EV');");
    console.log('  ✅ Updated existing rows to \"Own Board\"');

    // 3. Change the column back to the new ENUM
    await sequelize.query("ALTER TABLE cars MODIFY COLUMN number_plate_color ENUM('Own Board', 'T-Board', 'EV') NOT NULL DEFAULT 'Own Board';");
    console.log('  ✅ Changed column back to updated ENUM');

  } catch (e) {
    console.log('  ⚠️  Could not update enum:', e.message);
  }

  await sequelize.close();
  console.log('\n🎉 Enum update complete!');
}

run().catch(err => {
  console.error('❌ Update failed:', err.message);
  process.exit(1);
});
