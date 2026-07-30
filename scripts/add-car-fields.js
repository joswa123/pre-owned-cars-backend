// scripts/add-car-fields.js
const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

async function run() {
  await sequelize.authenticate();
  console.log('✅ Connected to DB:', process.env.DB_NAME);

  console.log('\n🔄 Adding number_plate_color to cars...');
  try {
    await sequelize.query("ALTER TABLE cars ADD COLUMN number_plate_color ENUM('White', 'Yellow', 'Black', 'Green', 'Red') NOT NULL DEFAULT 'White';");
    console.log('  ✅ number_plate_color column added to cars');
  } catch (e) {
    if (e.message.includes('Duplicate column name')) {
      console.log('  ✅ number_plate_color already exists');
    } else {
      console.log('  ⚠️  Could not add number_plate_color:', e.message);
    }
  }

  console.log('\n🔄 Adding insurance_type to cars...');
  try {
    await sequelize.query("ALTER TABLE cars ADD COLUMN insurance_type ENUM('Comprehensive', 'Third Party', 'Not Insured') NOT NULL DEFAULT 'Not Insured';");
    console.log('  ✅ insurance_type column added to cars');
  } catch (e) {
    if (e.message.includes('Duplicate column name')) {
      console.log('  ✅ insurance_type already exists');
    } else {
      console.log('  ⚠️  Could not add insurance_type:', e.message);
    }
  }

  console.log('\n🔄 Adding appointment_required to cars...');
  try {
    await sequelize.query("ALTER TABLE cars ADD COLUMN appointment_required TINYINT(1) NOT NULL DEFAULT 0;");
    console.log('  ✅ appointment_required column added to cars');
  } catch (e) {
    if (e.message.includes('Duplicate column name')) {
      console.log('  ✅ appointment_required already exists');
    } else {
      console.log('  ⚠️  Could not add appointment_required:', e.message);
    }
  }

  await sequelize.close();
  console.log('\n🎉 Schema update complete!');
}

run().catch(err => {
  console.error('❌ Update failed:', err.message);
  process.exit(1);
});
