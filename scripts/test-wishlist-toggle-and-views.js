require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Variant, Car, Wishlist, View } = require('../src/models');
const carService = require('../src/services/carService');

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

  let testSeller, testBuyer, sellerToken, buyerToken;
  let brand, carModel, variant, car;

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // Clean up previous test users
    const oldUsers = await User.findAll({
      where: { email: ['wl_seller@test.com', 'wl_buyer@test.com'] },
    });
    for (const u of oldUsers) {
      await Wishlist.destroy({ where: { user_id: u.id } });
      await View.destroy({ where: { user_id: u.id } });
      await Car.unscoped().destroy({ where: { user_id: u.id } });
      await u.destroy();
    }

    const hashedPass = await bcrypt.hash('TestPass123!', 10);
    testSeller = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Wishlist Seller',
      phone: '9555000001',
      email: 'wl_seller@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
    });
    sellerToken = jwt.sign({ id: testSeller.id, role: testSeller.role }, process.env.JWT_SECRET || 'jwt_secret', { expiresIn: '1h' });

    testBuyer = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Wishlist Buyer',
      phone: '9555000002',
      email: 'wl_buyer@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    buyerToken = jwt.sign({ id: testBuyer.id, role: testBuyer.role }, process.env.JWT_SECRET || 'jwt_secret', { expiresIn: '1h' });

    const uniqueSuffix = Date.now();
    brand = await Brand.create({ id: require('crypto').randomUUID(), name: `Brand WL ${uniqueSuffix}`, logo: 'b.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: `Model WL ${uniqueSuffix}`, brandId: brand.id, body_type: 'Sedan' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: `Variant WL ${uniqueSuffix}`, model_id: carModel.id, fuel_type: 'Petrol', transmission: 'Manual' });

    car = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: testSeller.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2022,
      price: 600000,
      km_driven: 20000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      number_plate: 'TN 99 WL 1111',
      posted_by_type: 'dealer',
      status: 'active',
    });

    console.log('======================================================');
    console.log('TEST SUITE: WISHLIST TOGGLE & VIEW DUPLICATE PREVENTION');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: View Duplicate Prevention
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: View Duplicate Prevention ---');
    // User views the car 5 times
    await carService.recordView(car.id, testBuyer.id);
    await carService.recordView(car.id, testBuyer.id);
    await carService.recordView(car.id, testBuyer.id);
    await carService.recordView(car.id, testBuyer.id);
    await carService.recordView(car.id, testBuyer.id);

    const viewCount = await View.count({ where: { car_id: car.id, user_id: testBuyer.id } });
    assert('Same user viewing car 5 times produces exactly 1 row in views table', viewCount === 1, `Got count: ${viewCount}`);

    // -------------------------------------------------------------------------
    // TEST 2: Wishlist Toggle API (POST /api/v1/wishlist/toggle)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Wishlist Toggle Endpoint ---');

    // Toggle 1: Add to wishlist
    let res = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ carId: car.id });

    assert('Toggle 1 returns 200 OK', res.statusCode === 200);
    assert('Toggle 1 reports is_wishlisted: true', res.body.is_wishlisted === true);
    assert('Toggle 1 message is "Added to wishlist"', res.body.message === 'Added to wishlist');
    let dbWishlistCount = await Wishlist.count({ where: { user_id: testBuyer.id, car_id: car.id } });
    assert('DB has exactly 1 wishlist record after Toggle 1', dbWishlistCount === 1);

    // Toggle 2: Remove from wishlist (unwishlist)
    res = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ carId: car.id });

    assert('Toggle 2 returns 200 OK', res.statusCode === 200);
    assert('Toggle 2 reports is_wishlisted: false', res.body.is_wishlisted === false);
    assert('Toggle 2 message is "Removed from wishlist"', res.body.message === 'Removed from wishlist');
    dbWishlistCount = await Wishlist.count({ where: { user_id: testBuyer.id, car_id: car.id } });
    assert('DB has 0 wishlist records after Toggle 2 (no duplicate entries)', dbWishlistCount === 0);

    // Toggle 3: Re-add
    res = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: car.id });
    assert('Toggle 3 (with car_id snake_case) adds back successfully', res.statusCode === 200 && res.body.is_wishlisted === true);
    dbWishlistCount = await Wishlist.count({ where: { user_id: testBuyer.id, car_id: car.id } });
    assert('DB has exactly 1 wishlist record after Toggle 3', dbWishlistCount === 1);

    // -------------------------------------------------------------------------
    // TEST 3: Idempotent Add to Wishlist (POST /api/v1/wishlist)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Idempotent Wishlist Add ---');
    // Already added in Toggle 3. Calling add again should not fail or duplicate.
    res = await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ carId: car.id });

    assert('POST /wishlist (add) on already wishlisted car returns 200 OK', res.statusCode === 200);
    dbWishlistCount = await Wishlist.count({ where: { user_id: testBuyer.id, car_id: car.id } });
    assert('DB still has exactly 1 wishlist record (no duplicates)', dbWishlistCount === 1);

    // -------------------------------------------------------------------------
    // TEST 4: Idempotent Wishlist Remove (DELETE /api/v1/wishlist/:carId)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Idempotent Wishlist Remove ---');
    res = await request(app)
      .delete(`/api/v1/wishlist/${car.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    assert('DELETE /wishlist/:carId returns 200 OK', res.statusCode === 200);

    // Delete second time
    res = await request(app)
      .delete(`/api/v1/wishlist/${car.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    assert('DELETE /wishlist/:carId again returns 200 OK (idempotent)', res.statusCode === 200);

    // -------------------------------------------------------------------------
    // TEST 5: Dashboard Summary Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Dashboard Summary Integrity ---');
    res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${sellerToken}`);

    assert('GET /users/me/dashboard returns 200 OK', res.statusCode === 200);
    assert('Dashboard contains cars metrics with total: 1 and active: 1', res.body.data?.cars?.total === 1 && res.body.data?.cars?.active === 1);
    assert('Dashboard contains leads metrics object', typeof res.body.data?.leads?.total === 'number');

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
      if (car) await Car.unscoped().destroy({ where: { id: car.id } });
      if (variant) await variant.destroy().catch(() => {});
      if (carModel) await carModel.destroy().catch(() => {});
      if (brand) await brand.destroy().catch(() => {});
      if (testSeller) {
        await Wishlist.destroy({ where: { user_id: testSeller.id } });
        await View.destroy({ where: { user_id: testSeller.id } });
        await testSeller.destroy().catch(() => {});
      }
      if (testBuyer) {
        await Wishlist.destroy({ where: { user_id: testBuyer.id } });
        await View.destroy({ where: { user_id: testBuyer.id } });
        await testBuyer.destroy().catch(() => {});
      }
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
