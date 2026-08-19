require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Variant, Car, CarImage } = require('../src/models');

async function runMarkCarSoldTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  const assert = (name, condition, detail = '') => {
    if (condition) {
      passed++;
      results.push({ name, status: 'PASSED', detail });
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      failed++;
      results.push({ name, status: 'FAILED', detail });
      console.error(`  ❌ [FAIL] ${name} ${detail ? `-> (${detail})` : ''}`);
    }
  };

  let userA, userB, adminUser;
  let tokenA, tokenB, adminToken;
  let brand, carModel, variant;
  const createdCarIds = [];

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // 1. Setup Test Users
    console.log('👤 Setting up test users (Owner A, Stranger B, Admin)...');
    const hashedPass = await bcrypt.hash('Secret123!', 10);
    await User.destroy({ where: { email: ['car_owner_a@test.com', 'car_stranger_b@test.com', 'car_admin@test.com'] } });

    userA = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Seller User A',
      phone: '9999600001',
      email: 'car_owner_a@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenA = jwt.sign({ id: userA.id, role: userA.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    userB = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Stranger User B',
      phone: '9999600002',
      email: 'car_stranger_b@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenB = jwt.sign({ id: userB.id, role: userB.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    adminUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Platform Admin',
      phone: '9999600003',
      email: 'car_admin@test.com',
      password_hash: hashedPass,
      role: 'admin',
      is_verified: true,
    });
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Setup Brand, Model, Variant
    brand = await Brand.create({ id: require('crypto').randomUUID(), name: 'Sold Test Brand Tata', logo: 'tata.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: 'Nexon', brandId: brand.id, body_type: 'SUV' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: 'XZ Plus', model_id: carModel.id });

    // Helper to create test car
    const createTestCar = async (ownerId, status = 'active') => {
      const car = await Car.create({
        id: require('crypto').randomUUID(),
        user_id: ownerId,
        brand_id: brand.id,
        model_id: carModel.id,
        variant_id: variant.id,
        year: 2022,
        price: 950000,
        price_negotiable: false,
        km_driven: 20000,
        fuel_type: 'Diesel',
        transmission: 'Manual',
        ownership: '1st Owner',
        body_type: 'SUV',
        board_type: 'Own Board',
        insurance_type: 'Comprehensive',
        posted_by_type: 'customer',
        status,
        color: 'Foliage Green',
        number_plate: 'TN01XY1234',
      });
      createdCarIds.push(car.id);
      return car;
    };

    console.log('\n======================================================');
    console.log('TEST SUITE: PATCH /api/v1/cars/:id/sell');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Owner marks their active car as sold
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Owner sells active car ---');
    const car1 = await createTestCar(userA.id, 'active');

    let res = await request(app)
      .patch(`/api/v1/cars/${car1.id}/sell`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert('Owner can mark active car as sold (200 OK)', res.statusCode === 200, `Status: ${res.statusCode}`);
    assert('Returned car status is "sold"', res.body.data?.car?.status === 'sold');

    const dbCar1 = await Car.findByPk(car1.id);
    assert('Database status is updated to "sold"', dbCar1.status === 'sold');

    // -------------------------------------------------------------------------
    // TEST 2: Owner marks an already sold car as sold -> 400 Bad Request
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Re-selling already sold car ---');
    res = await request(app)
      .patch(`/api/v1/cars/${car1.id}/sell`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert('Selling already sold car returns 400 Bad Request', res.statusCode === 400, `Status: ${res.statusCode}`);
    assert('Error message indicates car is already sold', res.body.message?.includes('already sold'), `Message: ${res.body.message}`);

    // -------------------------------------------------------------------------
    // TEST 3: Non-owner tries to sell -> 403 Forbidden
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Non-owner unauthorized sell attempt ---');
    const car2 = await createTestCar(userA.id, 'active');

    res = await request(app)
      .patch(`/api/v1/cars/${car2.id}/sell`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});

    assert('Non-owner sell attempt returns 403 Forbidden', res.statusCode === 403, `Status: ${res.statusCode}`);

    // -------------------------------------------------------------------------
    // TEST 4: Admin sells any user car -> 200 OK
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Admin sells any car ---');
    res = await request(app)
      .patch(`/api/v1/cars/${car2.id}/sell`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    assert('Admin can mark user car as sold (200 OK)', res.statusCode === 200, `Status: ${res.statusCode}`);
    assert('Admin sold car status updated to "sold"', res.body.data?.car?.status === 'sold');

    // -------------------------------------------------------------------------
    // TEST 5: Selling a deleted car -> 400 Bad Request
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Selling a deleted car ---');
    const car3 = await createTestCar(userA.id, 'deleted');

    res = await request(app)
      .patch(`/api/v1/cars/${car3.id}/sell`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert('Selling deleted car returns 400 Bad Request', res.statusCode === 400, `Status: ${res.statusCode}`);
    assert('Error message indicates cannot sell deleted car', res.body.message?.includes('deleted'), `Message: ${res.body.message}`);

    // -------------------------------------------------------------------------
    // TEST 6: Selling non-existent car -> 404 Not Found
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Selling non-existent car ---');
    const fakeCarId = require('crypto').randomUUID();

    res = await request(app)
      .patch(`/api/v1/cars/${fakeCarId}/sell`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert('Selling non-existent car returns 404 Not Found', res.statusCode === 404, `Status: ${res.statusCode}`);

    // -------------------------------------------------------------------------
    // TEST 7: Verification in Public List & User Cars
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Query Visibility Verification ---');

    // Public list excludes sold cars
    const publicListRes = await request(app).get('/api/v1/cars');
    const publicCars = publicListRes.body.data?.cars || [];
    assert('Public GET /cars excludes sold car1', !publicCars.some(c => c.id === car1.id));
    assert('Public GET /cars excludes sold car2', !publicCars.some(c => c.id === car2.id));

    // Seller's /me list with status=sold includes sold car
    const userCarsRes = await request(app)
      .get('/api/v1/cars/me?status=sold')
      .set('Authorization', `Bearer ${tokenA}`);

    const soldCars = userCarsRes.body.data?.cars || [];
    assert('Seller GET /cars/me?status=sold includes sold car1', soldCars.some(c => c.id === car1.id));

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n======================================================');
    console.log('MARK CAR AS SOLD TEST SUMMARY');
    console.log('======================================================');
    console.log(`Total Assertions: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Unexpected error during test run:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    try {
      if (createdCarIds.length > 0) {
        await Car.unscoped().destroy({ where: { id: createdCarIds } });
      }
      if (variant) await variant.destroy();
      if (carModel) await carModel.destroy();
      if (brand) await brand.destroy();
      if (userA) await userA.destroy();
      if (userB) await userB.destroy();
      if (adminUser) await adminUser.destroy();
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runMarkCarSoldTests();
