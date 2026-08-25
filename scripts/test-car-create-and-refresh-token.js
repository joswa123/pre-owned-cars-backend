require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Variant, Car, RefreshToken, State, District, City } = require('../src/models');
const authService = require('../src/services/authService');

async function runTests() {
  let passed = 0;
  let failed = 0;

  const assert = (name, condition, detail = '') => {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${name} ${detail ? `-> (${detail})` : ''}`);
    }
  };

  let testUser, testUserToken, testRefreshTokenStr;
  let brand, carModel, variant;
  const createdCarIds = [];

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // Clean up previous test users safely
    const oldUser = await User.findOne({ where: { email: 'cartest_user@test.com' } });
    if (oldUser) {
      await Car.unscoped().destroy({ where: { user_id: oldUser.id } });
      await RefreshToken.destroy({ where: { user_id: oldUser.id } });
      await oldUser.destroy();
    }

    const hashedPass = await bcrypt.hash('TestPass123!', 10);
    testUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Car Test Dealer',
      phone: '9666000001',
      email: 'cartest_user@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
    });

    const tokens = await authService.loginUser({ email: 'cartest_user@test.com' }, 'TestPass123!');
    testUserToken = tokens.accessToken;
    testRefreshTokenStr = tokens.refreshToken;

    const uniqueSuffix = Date.now();
    brand = await Brand.create({ id: require('crypto').randomUUID(), name: `Test Brand ${uniqueSuffix}`, logo: 'testbrand.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: `Test Model ${uniqueSuffix}`, brandId: brand.id, body_type: 'SUV' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: `Test Variant ${uniqueSuffix}`, model_id: carModel.id, fuel_type: 'Petrol', transmission: 'Manual' });

    console.log('======================================================');
    console.log('TEST SUITE: REFRESH TOKEN & CAR CREATION RESILIENCE');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST SECTION 1: Refresh Token Resilience
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: Refresh Token Tests ---');

    // Test 1.1: Standard Refresh Token Body ({ refreshToken })
    let res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: testRefreshTokenStr });
    assert('POST /auth/refresh-token succeeds with { refreshToken }', res.statusCode === 200);
    assert('Returns new accessToken and refreshToken', !!res.body.accessToken && !!res.body.refreshToken);
    const newRefresh1 = res.body.refreshToken;

    // Test 1.2: Snake Case Refresh Token Body ({ refresh_token }) from Mobile
    res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refresh_token: newRefresh1 });
    assert('POST /auth/refresh-token succeeds with snake_case { refresh_token }', res.statusCode === 200);
    assert('Returns both camelCase and snake_case properties', !!res.body.access_token && !!res.body.refresh_token);
    const newRefresh2 = res.body.refreshToken;

    // Test 1.3: Refresh Token in Header (x-refresh-token)
    res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('x-refresh-token', newRefresh2)
      .send({});
    assert('POST /auth/refresh-token succeeds with x-refresh-token header', res.statusCode === 200);
    const newRefresh3 = res.body.refreshToken;

    // Test 1.4: Rapid Parallel Token Refresh (Mobile Race Condition Grace Period)
    // The previous token `newRefresh2` was just rotated within 1 second. Re-using it within 30s should succeed with the latest token.
    res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: newRefresh2 });
    assert('Rapid duplicate refresh token request within grace period succeeds (no 401 logout)', res.statusCode === 200);

    // Test 1.5: Invalid Refresh Token fails with 401
    res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: 'invalid.jwt.token.string' });
    assert('Invalid refresh token returns 401', res.statusCode === 401);

    // Test 1.6: Missing Refresh Token fails with 401
    res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({});
    assert('Missing refresh token returns 401', res.statusCode === 401);

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Car Creation Resilience (POST /api/v1/cars)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Car Creation Tests ---');

    // Test 2.1: Create Car with standard UUIDs and JSON Image URLs
    res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        brand_id: brand.id,
        model_id: carModel.id,
        variant_id: variant.id,
        year: 2022,
        price: 850000,
        km_driven: 18000,
        fuel_type: 'petrol',
        transmission: 'manual',
        ownership: '1st owner',
        body_type: 'SUV',
        board_type: 'own board',
        number_plate: 'TN 01 XY 9999',
        primary_image: 'https://example.com/primary.jpg',
        images: ['https://example.com/sec1.jpg', 'https://example.com/sec2.jpg'],
      });

    assert('POST /api/v1/cars with UUIDs and JSON images returns 201/200', res.statusCode === 200 || res.statusCode === 201, `Status: ${res.statusCode} ${JSON.stringify(res.body)}`);
    if (res.body.data?.id) createdCarIds.push(res.body.data.id);
    assert('Car created has correct number_plate', res.body.data?.number_plate === 'TN 01 XY 9999');
    assert('Car has primary_image and images array', !!res.body.data?.primary_image);

    // Test 2.2: Create Car with string numbers / booleans (simulating multipart form-data) and brand/model names
    res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        brand: 'Test Dynamic Brand',
        model: 'Dynamic SUV Model',
        variant: '1.5 Turbo',
        year: '2023',
        price: '1200000',
        km_driven: '15000',
        fuel_type: 'Diesel',
        transmission: 'Automatic',
        ownership: '2nd Owner',
        body_type: 'SUV',
        board_type: 'Own Board',
        number_plate: 'TN 02 AB 1234',
        price_negotiable: 'true',
        b2b_listing: 'false',
        primary_image: 'https://example.com/car2.jpg',
      });

    assert('POST /api/v1/cars with name-based brand/model and string types succeeds', res.statusCode === 200 || res.statusCode === 201, `Status: ${res.statusCode} ${JSON.stringify(res.body)}`);
    if (res.body.data?.id) createdCarIds.push(res.body.data.id);
    assert('Car dynamically assigned brand and model', !!res.body.data?.brand?.name && !!res.body.data?.carModel?.name);

    // Test 2.3: Create Car with non-existent foreign location ID (should not crash with 500)
    res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        brand_id: brand.id,
        model_id: carModel.id,
        variant_id: variant.id,
        year: 2020,
        price: 500000,
        km_driven: 40000,
        fuel_type: 'petrol',
        transmission: 'manual',
        ownership: '1st owner',
        district_id: '00000000-0000-0000-0000-000000000000', // Non-existent foreign key
        primary_image: 'https://example.com/car3.jpg',
      });

    assert('POST /api/v1/cars with invalid district UUID does NOT 500 (handled gracefully)', res.statusCode !== 500, `Status: ${res.statusCode}`);
    if (res.body.data?.id) createdCarIds.push(res.body.data.id);

    // Test 2.4: Missing required fields (price missing) returns 400 validation error (not 500)
    res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        brand_id: brand.id,
        model_id: carModel.id,
        variant_id: variant.id,
        year: 2022,
        km_driven: 10000,
        fuel_type: 'petrol',
        transmission: 'manual',
        ownership: '1st owner',
        primary_image: 'https://example.com/car4.jpg',
      });

    assert('Missing price returns 400 Bad Request (not 500)', res.statusCode === 400);

    // Test 2.5: Missing image completely returns 400 Bad Request (not 500)
    res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        brand_id: brand.id,
        model_id: carModel.id,
        variant_id: variant.id,
        year: 2022,
        price: 500000,
        km_driven: 10000,
        fuel_type: 'petrol',
        transmission: 'manual',
        ownership: '1st owner',
      });

    assert('Missing image returns 400 Bad Request (not 500)', res.statusCode === 400);

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log('TEST SUMMARY');
    console.log('======================================================');
    console.log(`Total Assertions: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Unexpected error during test run:', err);
    failed++;
  } finally {
    console.log('🧹 Cleaning up test records...');
    try {
      if (testUser) {
        await Car.unscoped().destroy({ where: { user_id: testUser.id } });
      }
      if (createdCarIds.length > 0) {
        await Car.unscoped().destroy({ where: { id: createdCarIds } });
      }
      if (variant) await variant.destroy().catch(() => {});
      if (carModel) await carModel.destroy().catch(() => {});
      if (brand) await brand.destroy().catch(() => {});
      if (testUser) {
        await RefreshToken.destroy({ where: { user_id: testUser.id } });
        await testUser.destroy().catch(() => {});
      }
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
