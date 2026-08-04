// scripts/seed-admin-runner.js
const dotenv = require('dotenv');
dotenv.config();

const sequelize = require('../src/config/database');
const seedAdmin = require('../src/utils/admin');

async function run() {
  console.log('🔄 Connecting to DB:', process.env.DB_NAME);
  await sequelize.authenticate();
  
  console.log('👑 Seeding/Syncing Admin user...');
  await seedAdmin();

  const { User } = require('../src/models');
  const admin = await User.findOne({ where: { role: 'admin' } });
  if (admin) {
    console.log(`\n✅ ADMIN ACCOUNT READY!`);
    console.log(`   Phone:    ${admin.phone}`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  } else {
    console.log('⚠️ Could not find admin account after seeding.');
  }

  await sequelize.close();
}

run().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
