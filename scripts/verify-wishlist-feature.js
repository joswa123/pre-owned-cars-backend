// scripts/verify-wishlist-feature.js
require('dotenv').config();
process.env.DB_SSL = 'true';

const sequelize = require('../src/config/database');
const redisClient = require('../src/config/redis');
const { carQuerySchema } = require('../src/validations/carValidation');
const carService = require('../src/services/carService');
const wishlistService = require('../src/services/wishlistService');
const { Car, Wishlist, User } = require('../src/models');

async function runTests() {
  console.log('🧪 Starting Wishlist Count & Filter Verification...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // 1. Validation Schema Tests
    // ----------------------------------------------------
    console.log('📋 Test 1: Joi carQuerySchema Validation');

    const validTrueBool = carQuerySchema.validate({ has_wishlist: true });
    assert(!validTrueBool.error, 'has_wishlist: true is valid');

    const validTrueStr = carQuerySchema.validate({ has_wishlist: 'true' });
    assert(!validTrueStr.error, "has_wishlist: 'true' is valid");

    const validFalseBool = carQuerySchema.validate({ has_wishlist: false });
    assert(!validFalseBool.error, 'has_wishlist: false is valid');

    const validFalseStr = carQuerySchema.validate({ has_wishlist: 'false' });
    assert(!validFalseStr.error, "has_wishlist: 'false' is valid");

    const validMinWishlist = carQuerySchema.validate({ min_wishlist: 3 });
    assert(!validMinWishlist.error, 'min_wishlist: 3 is valid');

    const invalidMinWishlist = carQuerySchema.validate({ min_wishlist: -1 });
    assert(!!invalidMinWishlist.error, 'min_wishlist: -1 is invalid');

    const invalidHasWishlist = carQuerySchema.validate({ has_wishlist: 'maybe' });
    assert(!!invalidHasWishlist.error, "has_wishlist: 'maybe' is invalid");

    // ----------------------------------------------------
    // Database Connection
    // ----------------------------------------------------
    console.log('\n🔌 Connecting to DB & Redis...');
    await sequelize.authenticate();
    console.log('  Connected to MySQL.');

    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
        console.log('  Connected to Redis.');
      } catch (e) {
        console.log('  Redis connection skipped / failed:', e.message);
      }
    }

    // ----------------------------------------------------
    // 2. getCars wishlist_count Field Verification
    // ----------------------------------------------------
    console.log('\n🚗 Test 2: getCars Response includes integer wishlist_count');
    const allCarsResult = await carService.getCars({}, 1, 10);
    assert(Array.isArray(allCarsResult.cars), 'cars is an array');
    assert(allCarsResult.cars.length > 0, `Returned ${allCarsResult.cars.length} cars`);

    let allCountsValid = true;
    for (const car of allCarsResult.cars) {
      if (typeof car.wishlist_count !== 'number' || car.wishlist_count < 0 || !Number.isInteger(car.wishlist_count)) {
        allCountsValid = false;
        console.error(`Invalid wishlist_count on car ${car.id}:`, car.wishlist_count);
        break;
      }
    }
    assert(allCountsValid, 'All cars contain integer wishlist_count >= 0');

    // ----------------------------------------------------
    // 3. has_wishlist=true Filter Verification
    // ----------------------------------------------------
    console.log('\n🔍 Test 3: getCars with has_wishlist=true');
    const wishlistedCarsResult = await carService.getCars({ has_wishlist: true }, 1, 10);
    console.log(`  Found ${wishlistedCarsResult.total} cars with has_wishlist=true`);
    let allWishlistedPositive = true;
    for (const car of wishlistedCarsResult.cars) {
      if (car.wishlist_count <= 0) {
        allWishlistedPositive = false;
        console.error(`Car ${car.id} has count ${car.wishlist_count} when has_wishlist=true`);
      }
    }
    assert(allWishlistedPositive, 'All cars returned with has_wishlist=true have wishlist_count > 0');

    // ----------------------------------------------------
    // 4. has_wishlist=false Filter Verification
    // ----------------------------------------------------
    console.log('\n🔍 Test 4: getCars with has_wishlist=false');
    const nonWishlistedCarsResult = await carService.getCars({ has_wishlist: false }, 1, 10);
    console.log(`  Found ${nonWishlistedCarsResult.total} cars with has_wishlist=false`);
    let allNonWishlistedZero = true;
    for (const car of nonWishlistedCarsResult.cars) {
      if (car.wishlist_count !== 0) {
        allNonWishlistedZero = false;
        console.error(`Car ${car.id} has count ${car.wishlist_count} when has_wishlist=false`);
      }
    }
    assert(allNonWishlistedZero, 'All cars returned with has_wishlist=false have wishlist_count === 0');

    // ----------------------------------------------------
    // 5. min_wishlist Filter Verification
    // ----------------------------------------------------
    console.log('\n🔍 Test 5: getCars with min_wishlist=1');
    const minWishlistCars = await carService.getCars({ min_wishlist: 1 }, 1, 10);
    let allMeetMin = true;
    for (const car of minWishlistCars.cars) {
      if (car.wishlist_count < 1) {
        allMeetMin = false;
        console.error(`Car ${car.id} has count ${car.wishlist_count} when min_wishlist=1`);
      }
    }
    assert(allMeetMin, 'All cars returned with min_wishlist=1 have wishlist_count >= 1');

    // ----------------------------------------------------
    // 6. getCarById wishlist_count Verification
    // ----------------------------------------------------
    console.log('\n🔍 Test 6: getCarById Response includes integer wishlist_count');
    const testCarId = allCarsResult.cars[0].id;
    const detailCar = await carService.getCarById(testCarId);
    assert(typeof detailCar.wishlist_count === 'number', `Detail car wishlist_count is number (${detailCar.wishlist_count})`);
    assert(Number.isInteger(detailCar.wishlist_count), 'Detail car wishlist_count is integer');
    assert(typeof detailCar.metrics?.wishlist_count === 'number', `Detail metrics.wishlist_count is number (${detailCar.metrics?.wishlist_count})`);
    assert(detailCar.wishlist_count === detailCar.metrics.wishlist_count, 'Root and metrics wishlist_count match');

    // ----------------------------------------------------
    // 7. Cache Invalidation Verification
    // ----------------------------------------------------
    console.log('\n🧹 Test 7: Cache Invalidation on Wishlist toggle');
    if (redisClient.isOpen) {
      // Set test keys
      await redisClient.set(`cars:list:test_key`, 'cached_list_test');
      await redisClient.set(`car:${testCarId}`, JSON.stringify({ id: testCarId, cached: true }));

      // Verify they exist
      const beforeListKey = await redisClient.get(`cars:list:test_key`);
      const beforeDetailKey = await redisClient.get(`car:${testCarId}`);
      assert(beforeListKey === 'cached_list_test', 'cars:list:* test key was set');
      assert(!!beforeDetailKey, 'car:${carId} test key was set');

      // Find or pick a user for toggle test
      const aUser = await User.findOne();
      if (aUser) {
        // Toggle twice to restore original state
        const toggleResult1 = await wishlistService.toggleWishlist(aUser.id, testCarId);
        console.log(`  Toggle 1 message: ${toggleResult1.message}`);

        // Check if cache keys were cleared
        const afterListKey = await redisClient.get(`cars:list:test_key`);
        const afterDetailKey = await redisClient.get(`car:${testCarId}`);
        assert(!afterListKey, 'cars:list:* key was successfully invalidated');
        assert(!afterDetailKey, 'car:${carId} key was successfully invalidated');

        // Toggle back
        const toggleResult2 = await wishlistService.toggleWishlist(aUser.id, testCarId);
        console.log(`  Toggle 2 message: ${toggleResult2.message}`);
      } else {
        console.log('  (No test user available to test toggle execution directly)');
      }
    } else {
      console.log('  (Redis not open, skipped redis key verification)');
    }

    console.log(`\n========================================`);
    console.log(`Results: ${passed} passed, ${failed} failed.`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('❌ Verification test error:', err);
    failed++;
  } finally {
    try {
      await sequelize.close();
    } catch (e) {}
    if (redisClient.isOpen) {
      try {
        await redisClient.disconnect();
      } catch (e) {}
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
