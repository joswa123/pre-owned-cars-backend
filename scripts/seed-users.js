require('dotenv').config();
const { User, DealerProfile } = require('../src/models');
const sequelize = require('../src/config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  try {
    const password_hash = await bcrypt.hash('password123', 10);

    const { User, DealerProfile, City, District, State } = require('../src/models');
    
    // Look for a valid city in the live database to assign to the users
    const city = await City.findOne({ 
      include: [
        { model: District, as: 'district', include: [{ model: State, as: 'state' }] }
      ] 
    });

    let stateId = null, districtId = null, cityId = null;
    if (city && city.district) {
      cityId = city.id;
      districtId = city.district.id;
      stateId = city.district.state.id;
      console.log(`📍 Found location for test users: ${city.name}, ${city.district.name}, ${city.district.state.name}`);
    } else {
      console.log('⚠️ No cities found in DB. Test users will not have location details assigned.');
    }

    // 1. Create or Update a Customer User
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
        state_id: stateId,
        district_id: districtId,
        city_id: cityId
      }
    });

    if (!createdCustomer && cityId) {
      await customer.update({ state_id: stateId, district_id: districtId, city_id: cityId });
    }

    if (createdCustomer) {
      console.log('✅ Created Customer User: customer@test.com / password123');
    } else {
      console.log('ℹ️  Customer user updated with location.');
    }

    // 2. Create or Update a Dealer User
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
        state_id: stateId,
        district_id: districtId,
        city_id: cityId
      }
    });

    if (!createdDealer && cityId) {
      await dealer.update({ state_id: stateId, district_id: districtId, city_id: cityId });
    }

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
      console.log('ℹ️  Dealer user updated with location.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed users:', error);
    process.exit(1);
  }
}

seedUsers();
