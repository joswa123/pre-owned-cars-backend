require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const redisClient = require('../config/redis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Variant, Car, Lead, Requirement } = require('../src/models');

async function runDashboardSummaryTests() {
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

  let customerUser, dealerUser, newUser;
  let customerToken, dealerToken, newToken;
  let brand, carModel, variant;
  let activeCar, soldCar, deletedCar;
  let lead1, lead2, lead3;
  let req1, req2;

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
        console.log('🔌 Redis connected successfully.\n');
      } catch (err) {
        console.warn('⚠️ Redis connection warning:', err.message);
      }
    }

    // Clean up any previous test records
    await User.destroy({
      where: {
        email: [
          'dash_customer@test.com',
          'dash_dealer@test.com',
          'dash_newuser@test.com',
        ],
      },
    });

    const hashedPass = await bcrypt.hash('Secret123!', 10);

    // 1. Setup Users
    customerUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Customer Dash Test',
      phone: '9888100001',
      email: 'dash_customer@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    customerToken = jwt.sign({ id: customerUser.id, role: customerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    dealerUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Dealer Dash Test',
      phone: '9888100002',
      email: 'dash_dealer@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
    });
    dealerToken = jwt.sign({ id: dealerUser.id, role: dealerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    newUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Fresh New User',
      phone: '9888100003',
      email: 'dash_newuser@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    newToken = jwt.sign({ id: newUser.id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Setup Brand & Model
    brand = await Brand.create({ id: require('crypto').randomUUID(), name: 'Dashboard Test Brand', logo: 'test.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: 'DashModel', brandId: brand.id, body_type: 'SUV' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: 'DashVariant', model_id: carModel.id });

    // Setup Cars for Dealer (1 active, 1 sold, 1 deleted)
    activeCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2023,
      price: 1500000,
      km_driven: 20000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'active',
    });

    soldCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2021,
      price: 1200000,
      km_driven: 40000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'sold',
    });

    deletedCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2020,
      price: 900000,
      km_driven: 60000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '2nd Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'deleted',
      deleted_at: new Date(),
    });

    // Setup Leads: Customer is buyer, Dealer is seller
    lead1 = await Lead.create({
      car_id: activeCar.id,
      seller_id: dealerUser.id,
      buyer_id: customerUser.id,
      buyer_name: customerUser.full_name,
      buyer_phone: customerUser.phone,
      source: 'whatsapp',
      status: 'new',
    });

    lead2 = await Lead.create({
      car_id: activeCar.id,
      seller_id: dealerUser.id,
      buyer_id: customerUser.id,
      buyer_name: customerUser.full_name,
      buyer_phone: customerUser.phone,
      source: 'call',
      status: 'new',
    });

    lead3 = await Lead.create({
      car_id: activeCar.id,
      seller_id: dealerUser.id,
      buyer_id: customerUser.id,
      buyer_name: customerUser.full_name,
      buyer_phone: customerUser.phone,
      source: 'message',
      status: 'new',
    });

    // Setup Requirements: 1 for dealer, 1 for customer
    req1 = await Requirement.create({
      user_id: customerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      purchase_plan_days: 30,
      expiry_date: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status: 'active',
    });

    req2 = await Requirement.create({
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      purchase_plan_days: 15,
      expiry_date: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      status: 'bought',
    });

    console.log('\n======================================================');
    console.log('TEST SUITE: DASHBOARD SUMMARY API');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: New User with No Data
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: New User (Zero Data) ---');
    let res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${newToken}`);

    assert('GET /me/dashboard returns 200 OK', res.statusCode === 200);
    assert('Response status is success', res.body.status === 'success');
    const newUserData = res.body.data;
    assert('Cars total is 0', newUserData.cars.total === 0);
    assert('Cars active is 0 (not null)', newUserData.cars.active === 0);
    assert('Cars sold is 0 (not null)', newUserData.cars.sold === 0);
    assert('Cars deleted is 0 (not null)', newUserData.cars.deleted === 0);
    assert('Leads total is 0', newUserData.leads.total === 0);
    assert('Leads whatsapp is 0', newUserData.leads.by_source.whatsapp === 0);
    assert('Leads call is 0', newUserData.leads.by_source.call === 0);
    assert('Leads message is 0', newUserData.leads.by_source.message === 0);
    assert('Requirements total is 0', newUserData.requirements.total === 0);
    assert('Requirements active is 0', newUserData.requirements.active === 0);

    // -------------------------------------------------------------------------
    // TEST 2: Customer Role (Leads Sent as Buyer)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Customer Dashboard ---');
    res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);

    assert('Customer dashboard returns 200 OK', res.statusCode === 200);
    const custData = res.body.data;
    assert('Customer cars total is 0', custData.cars.total === 0);
    assert('Customer leads total is 3 (sent as buyer)', custData.leads.total === 3);
    assert('Customer leads whatsapp count is 1', custData.leads.by_source.whatsapp === 1);
    assert('Customer leads call count is 1', custData.leads.by_source.call === 1);
    assert('Customer leads message count is 1', custData.leads.by_source.message === 1);
    assert('Customer requirements total is 1', custData.requirements.total === 1);
    assert('Customer requirements active is 1', custData.requirements.active === 1);

    // -------------------------------------------------------------------------
    // TEST 3: Dealer Role (Cars + Leads Received as Seller)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Dealer Dashboard ---');
    res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${dealerToken}`);

    assert('Dealer dashboard returns 200 OK', res.statusCode === 200);
    const dealerData = res.body.data;
    assert('Dealer cars total is 3', dealerData.cars.total === 3);
    assert('Dealer active cars is 1', dealerData.cars.active === 1);
    assert('Dealer sold cars is 1', dealerData.cars.sold === 1);
    assert('Dealer deleted cars is 1', dealerData.cars.deleted === 1);
    assert('Dealer leads total is 3 (received as seller)', dealerData.leads.total === 3);
    assert('Dealer leads whatsapp is 1', dealerData.leads.by_source.whatsapp === 1);
    assert('Dealer leads call is 1', dealerData.leads.by_source.call === 1);
    assert('Dealer leads message is 1', dealerData.leads.by_source.message === 1);
    assert('Dealer requirements total is 1', dealerData.requirements.total === 1);
    assert('Dealer requirements bought is 1', dealerData.requirements.bought === 1);

    // -------------------------------------------------------------------------
    // TEST 4: Redis Caching
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Redis Caching ---');
    const cacheKey = `dashboard:user:${dealerUser.id}`;
    if (redisClient.isOpen) {
      const cachedStr = await redisClient.get(cacheKey);
      assert('Dashboard data is cached in Redis', !!cachedStr);
      if (cachedStr) {
        const cachedObj = JSON.parse(cachedStr);
        assert('Cached data matches dealer cars total', cachedObj.cars.total === 3);
      }
    } else {
      console.log('  ⚠️ Redis client not open, skipping raw key check');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Cache Invalidation on Mutations
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Cache Invalidation on Mutations ---');
    const dashboardService = require('../src/services/dashboardService');

    // Invalidate dealer cache
    await dashboardService.invalidateDashboardCache(dealerUser.id);
    if (redisClient.isOpen) {
      const afterDel = await redisClient.get(cacheKey);
      assert('invalidateDashboardCache purges Redis key', afterDel === null);
    }

    // Create a new lead: should increment count
    const lead4 = await Lead.create({
      car_id: activeCar.id,
      seller_id: dealerUser.id,
      buyer_id: customerUser.id,
      buyer_name: 'Customer 4',
      buyer_phone: '9888100004',
      source: 'whatsapp',
      status: 'new',
    });
    await dashboardService.invalidateDashboardCache(dealerUser.id);

    res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${dealerToken}`);

    assert('After new lead, dealer leads count is now 4', res.body.data?.leads?.total === 4);
    assert('After new lead, whatsapp count is now 2', res.body.data?.leads?.by_source?.whatsapp === 2);

    await lead4.destroy();

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log('DASHBOARD SUMMARY TEST RESULTS');
    console.log('======================================================');
    console.log(`Total Assertions: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Unexpected error during test run:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test records...');
    try {
      if (lead1) await lead1.destroy();
      if (lead2) await lead2.destroy();
      if (lead3) await lead3.destroy();
      if (req1) await req1.destroy();
      if (req2) await req2.destroy();
      if (activeCar) await Car.unscoped().destroy({ where: { id: activeCar.id } });
      if (soldCar) await Car.unscoped().destroy({ where: { id: soldCar.id } });
      if (deletedCar) await Car.unscoped().destroy({ where: { id: deletedCar.id } });
      if (variant) await variant.destroy();
      if (carModel) await carModel.destroy();
      if (brand) await brand.destroy();
      if (customerUser) await customerUser.destroy();
      if (dealerUser) await dealerUser.destroy();
      if (newUser) await newUser.destroy();
      if (redisClient.isOpen) {
        await redisClient.del(`dashboard:user:${customerUser?.id}`);
        await redisClient.del(`dashboard:user:${dealerUser?.id}`);
        await redisClient.del(`dashboard:user:${newUser?.id}`);
      }
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runDashboardSummaryTests();
