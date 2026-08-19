require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Variant, Car, Requirement } = require('../src/models');

async function runMatchCarsTests() {
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

  let userA, userB;
  let tokenA, tokenB;
  let brand1, brand2;
  let model1, model2;
  let variant1, variant2;
  const createdCarIds = [];
  const createdReqIds = [];

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // 1. Setup Test Users
    console.log('👤 Setting up test users (User A - Owner, User B - Stranger)...');
    const hashedPass = await bcrypt.hash('Secret123!', 10);
    await User.destroy({ where: { email: ['match_user_a@test.com', 'match_user_b@test.com'] } });

    userA = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Requirement Matcher A',
      phone: '9999500001',
      email: 'match_user_a@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenA = jwt.sign({ id: userA.id, role: userA.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    userB = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Requirement Stranger B',
      phone: '9999500002',
      email: 'match_user_b@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenB = jwt.sign({ id: userB.id, role: userB.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Setup Brands and Models
    brand1 = await Brand.create({ id: require('crypto').randomUUID(), name: 'Match Brand Hyundai', logo: 'hyundai.png' });
    model1 = await Model.create({ id: require('crypto').randomUUID(), name: 'Verna', brandId: brand1.id, body_type: 'Sedan' });
    variant1 = await Variant.create({ id: require('crypto').randomUUID(), name: 'SX(O)', model_id: model1.id });

    brand2 = await Brand.create({ id: require('crypto').randomUUID(), name: 'Match Brand Maruti', logo: 'maruti.png' });
    model2 = await Model.create({ id: require('crypto').randomUUID(), name: 'Dzire', brandId: brand2.id, body_type: 'Sedan' });
    variant2 = await Variant.create({ id: require('crypto').randomUUID(), name: 'ZXi', model_id: model2.id });

    // 3. Create Sample Active & Sold & Mismatched Cars
    console.log('🚗 Creating sample cars for matching test...');
    
    // Car 1: Exact match for requirement 1 (Hyundai Verna, 2021, 850000, 30000km, Sedan, Automatic, Own Board)
    const car1 = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: userB.id,
      brand_id: brand1.id,
      model_id: model1.id,
      variant_id: variant1.id,
      year: 2021,
      price: 850000,
      km_driven: 30000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'customer',
      status: 'active',
    });
    createdCarIds.push(car1.id);

    // Car 2: Same Brand/Model but different Year (2019) & Transmission (Manual)
    const car2 = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: userB.id,
      brand_id: brand1.id,
      model_id: model1.id,
      variant_id: variant1.id,
      year: 2019,
      price: 650000,
      km_driven: 55000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '2nd Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'active',
    });
    createdCarIds.push(car2.id);

    // Car 3: Same specs as Car 1, but status='sold'
    const car3Sold = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: userB.id,
      brand_id: brand1.id,
      model_id: model1.id,
      variant_id: variant1.id,
      year: 2021,
      price: 850000,
      km_driven: 30000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'customer',
      status: 'sold',
    });
    createdCarIds.push(car3Sold.id);

    // Car 4: Different Brand/Model (Maruti Dzire)
    const car4 = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: userB.id,
      brand_id: brand2.id,
      model_id: model2.id,
      variant_id: variant2.id,
      year: 2021,
      price: 750000,
      km_driven: 25000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'customer',
      status: 'active',
    });
    createdCarIds.push(car4.id);

    console.log('\n======================================================');
    console.log('TEST SUITE: GET /requirements/:id/match-cars');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Exact Match (All Fields Specified)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Full Exact Match ---');
    const req1 = await Requirement.create({
      user_id: userA.id,
      brand_id: brand1.id,
      model_id: model1.id,
      year: 2021,
      price: 850000,
      km_driven: 30000,
      body_type: 'Sedan',
      transmission: 'Automatic',
      board_type: 'Own Board',
      purchase_plan_days: 30,
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
    });
    createdReqIds.push(req1.id);

    let matchRes = await request(app)
      .get(`/api/v1/requirements/${req1.id}/match-cars`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET /requirements/:id/match-cars returns 200 OK', matchRes.statusCode === 200, `Status: ${matchRes.statusCode}`);
    const matchedCars1 = matchRes.body.data?.cars || [];
    assert('Matched cars array has exactly 1 matching car', matchedCars1.length === 1, `Length: ${matchedCars1.length}`);
    assert('Matched car is car1 (exact match)', matchedCars1[0]?.id === car1.id);
    assert('Sold car (car3) is excluded from matching results', !matchedCars1.some(c => c.id === car3Sold.id));
    assert('Mismatched car (car2) is excluded', !matchedCars1.some(c => c.id === car2.id));

    // -------------------------------------------------------------------------
    // TEST 2: Partial Match (Requirement without optional year, price, km_driven)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Partial Match (Optional Fields Skipped) ---');
    const req2 = await Requirement.create({
      user_id: userA.id,
      brand_id: brand1.id,
      model_id: model1.id,
      year: null,
      price: null,
      km_driven: null,
      body_type: 'Sedan',
      transmission: 'Manual',
      board_type: 'Own Board',
      purchase_plan_days: 30,
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
    });
    createdReqIds.push(req2.id);

    matchRes = await request(app)
      .get(`/api/v1/requirements/${req2.id}/match-cars`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET /match-cars with partial requirement returns 200 OK', matchRes.statusCode === 200);
    const matchedCars2 = matchRes.body.data?.cars || [];
    assert('Matches car2 with same brand, model, body_type, manual transmission', matchedCars2.some(c => c.id === car2.id));
    assert('Excludes car1 (which has automatic transmission)', !matchedCars2.some(c => c.id === car1.id));

    // -------------------------------------------------------------------------
    // TEST 3: No Matching Active Cars -> Empty Array (200 OK)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: No Matching Cars ---');
    const reqNoMatch = await Requirement.create({
      user_id: userA.id,
      brand_id: brand2.id,
      model_id: model2.id,
      body_type: 'SUV', // Maruti Dzire is a Sedan, no SUV exists
      transmission: 'Automatic',
      board_type: 'Commercial',
      purchase_plan_days: 15,
      expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: 'active',
    });
    createdReqIds.push(reqNoMatch.id);

    matchRes = await request(app)
      .get(`/api/v1/requirements/${reqNoMatch.id}/match-cars`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('No matching cars returns 200 with empty array', matchRes.statusCode === 200 && matchRes.body.data?.cars?.length === 0);

    // -------------------------------------------------------------------------
    // TEST 4: Non-Owner Access Attempt -> 403 Forbidden
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Unauthorized Access Attempt ---');
    matchRes = await request(app)
      .get(`/api/v1/requirements/${req1.id}/match-cars`)
      .set('Authorization', `Bearer ${tokenB}`);

    assert('Non-owner cannot search cars for requirement (403 Forbidden)', matchRes.statusCode === 403);

    // -------------------------------------------------------------------------
    // TEST 5: Non-Existent Requirement -> 404 Not Found
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Non-Existent Requirement ---');
    const fakeId = require('crypto').randomUUID();
    matchRes = await request(app)
      .get(`/api/v1/requirements/${fakeId}/match-cars`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('Non-existent requirement returns 404 Not Found', matchRes.statusCode === 404);

    // -------------------------------------------------------------------------
    // TEST 6: Deleted Requirement -> 400 Bad Request
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Deleted Requirement ---');
    const reqDeleted = await Requirement.create({
      user_id: userA.id,
      brand_id: brand1.id,
      model_id: model1.id,
      body_type: 'Sedan',
      transmission: 'Automatic',
      board_type: 'Own Board',
      purchase_plan_days: 10,
      expiry_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'deleted',
    });
    createdReqIds.push(reqDeleted.id);

    matchRes = await request(app)
      .get(`/api/v1/requirements/${reqDeleted.id}/match-cars`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('Searching on deleted requirement returns 400 Bad Request', matchRes.statusCode === 400);

    // -------------------------------------------------------------------------
    // TEST 7: Expired Requirement -> 400 Bad Request
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Expired Requirement ---');
    const reqExpired = await Requirement.create({
      user_id: userA.id,
      brand_id: brand1.id,
      model_id: model1.id,
      body_type: 'Sedan',
      transmission: 'Automatic',
      board_type: 'Own Board',
      purchase_plan_days: 5,
      expiry_date: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      status: 'active',
    });
    createdReqIds.push(reqExpired.id);

    matchRes = await request(app)
      .get(`/api/v1/requirements/${reqExpired.id}/match-cars`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('Searching on expired requirement returns 400 Bad Request', matchRes.statusCode === 400);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n======================================================');
    console.log('MATCH CARS TO REQUIREMENT TEST SUMMARY');
    console.log('======================================================');
    console.log(`Total Assertions: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Unexpected error during test run:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test cars, requirements, brands, models, and users...');
    try {
      if (createdCarIds.length > 0) {
        await Car.unscoped().destroy({ where: { id: createdCarIds } });
      }
      if (createdReqIds.length > 0) {
        await Requirement.destroy({ where: { id: createdReqIds } });
      }
      if (variant1) await variant1.destroy();
      if (variant2) await variant2.destroy();
      if (model1) await model1.destroy();
      if (model2) await model2.destroy();
      if (brand1) await brand1.destroy();
      if (brand2) await brand2.destroy();
      if (userA) await userA.destroy();
      if (userB) await userB.destroy();
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runMatchCarsTests();
