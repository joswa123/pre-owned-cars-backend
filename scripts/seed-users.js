require('dotenv').config();
const { User, DealerProfile } = require('../src/models');
const sequelize = require('../src/config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  try {
    const password_hash = await bcrypt.hash('password123', 10);

    // 1. Create a Customer User
    const [customer, createdCustomer] = await User.findOrCreate({
      where: { email: 'customer@test.com' },
      defaults: {
        id: crypto.randomUUID(),
        full_name: 'Test Customer',
        email: 'customer@test.com',
        phone: '9999999991',
        password_hash,
        role: 'customer',
        status: 'approved',
        is_verified: true,
      }
    });

    if (createdCustomer) {
      console.log('✅ Created Customer User: customer@test.com / password123');
    } else {
      console.log('ℹ️  Customer user already exists.');
    }

    // 2. Create a Dealer User
    const [dealer, createdDealer] = await User.findOrCreate({
      where: { email: 'dealer@test.com' },
      defaults: {
        id: crypto.randomUUID(),
        full_name: 'Test Dealer',
        email: 'dealer@test.com',
        phone: '9999999992',
        password_hash,
        role: 'dealer',
        status: 'approved',
        is_verified: true,
      }
    });

    if (createdDealer) {
      await DealerProfile.create({
        id: crypto.randomUUID(),
        user_id: dealer.id,
        company_name: 'Premium Cars Ltd',
        door_no: '10',
        building_name: 'Tech Park',
        street_name: 'Main Street',
        pincode: '600001',
      });
      console.log('✅ Created Dealer User: dealer@test.com / password123');
    } else {
      console.log('ℹ️  Dealer user already exists.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed users:', error);
    process.exit(1);
  }
}

seedUsers();
