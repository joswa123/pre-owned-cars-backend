require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Variant, Car, Lead, View, Wishlist } = require('../src/models');
const carService = require('../src/services/carService');

async function runTests() {
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

  let dealerUserA, dealerUserB, buyerUser1, buyerUser2;
  let tokenA, tokenB, tokenBuyer1;
  let brand, carModel, variant;
  let carA, emptyCar;

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // Clean up previous test users
    await User.destroy({
      where: {
        email: [
          'dealer_a_test@test.com',
          'dealer_b_test@test.com',
          'buyer_1_test@test.com',
          'buyer_2_test@test.com',
        ],
      },
    });

    const hashedPass = await bcrypt.hash('Secret123!', 10);

    dealerUserA = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Dealer Alpha',
      phone: '9777100001',
      email: 'dealer_a_test@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
    });
    tokenA = jwt.sign({ id: dealerUserA.id, role: dealerUserA.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    dealerUserB = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Dealer Beta',
      phone: '9777100002',
      email: 'dealer_b_test@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
    });
    tokenB = jwt.sign({ id: dealerUserB.id, role: dealerUserB.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    buyerUser1 = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Buyer Ramesh',
      phone: '9777100003',
      email: 'buyer_1_test@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenBuyer1 = jwt.sign({ id: buyerUser1.id, role: buyerUser1.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    buyerUser2 = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Buyer Suresh',
      phone: '9777100004',
      email: 'buyer_2_test@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });

    brand = await Brand.create({ id: require('crypto').randomUUID(), name: 'Test Brand VW', logo: 'vw.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: 'Polo GT', brandId: brand.id, body_type: 'Hatchback' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: '1.0 TSI', model_id: carModel.id });

    // Car owned by Dealer A
    carA = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUserA.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2022,
      price: 850000,
      km_driven: 25000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Hatchback',
      board_type: 'Own Board',
      number_plate: 'TN 09 AB 1234',
      posted_by_type: 'dealer',
      status: 'active',
    });

    // Empty Car (no views, leads, wishlists)
    emptyCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUserA.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2021,
      price: 700000,
      km_driven: 35000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Hatchback',
      board_type: 'Own Board',
      number_plate: 'TN 09 CD 5678',
      posted_by_type: 'dealer',
      status: 'active',
    });

    console.log('\n======================================================');
    console.log('TEST SUITE: LEADS, WISHLIST, VIEWS LISTING & UNIQUE VIEWS');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Unique Views Recording (Same user 5 times -> 1 view record)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Unique View Recording ---');
    await carService.recordView(carA.id, buyerUser1.id);
    await carService.recordView(carA.id, buyerUser1.id);
    await carService.recordView(carA.id, buyerUser1.id);
    await carService.recordView(carA.id, buyerUser1.id);
    await carService.recordView(carA.id, buyerUser1.id);

    const viewCountForBuyer1 = await View.count({ where: { car_id: carA.id, user_id: buyerUser1.id } });
    assert('Same user viewing 5 times creates exactly 1 view record in DB', viewCountForBuyer1 === 1);

    // Record view for buyer 2
    await carService.recordView(carA.id, buyerUser2.id);
    const totalViewsForCar = await View.count({ where: { car_id: carA.id } });
    assert('Total distinct user views for car is 2', totalViewsForCar === 2);

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/v1/views/car/:carId (Views Listing)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Views Listing Endpoint ---');
    let res = await request(app)
      .get(`/api/v1/views/car/${carA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET /views/car/:carId returns 200 OK for car owner', res.statusCode === 200);
    assert('Response contains car_info with name and number_plate', res.body.data?.car_info?.number_plate === 'TN 09 AB 1234');
    const viewsList = res.body.data?.views || [];
    assert('Views list has 2 unique viewer entries', viewsList.length === 2);
    assert('Views item contains user_name, user_phone, viewed_at', !!viewsList[0].user_name && !!viewsList[0].user_phone && !!viewsList[0].viewed_at);

    // Unauthorized dealer cannot access Dealer A's views
    res = await request(app)
      .get(`/api/v1/views/car/${carA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert('Unauthorized dealer gets 404 Not Found for foreign car views', res.statusCode === 404);

    // -------------------------------------------------------------------------
    // TEST 3: Wishlist Listing Endpoint (GET /api/v1/wishlists/car/:carId)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Wishlists Listing Endpoint ---');
    await Wishlist.create({ user_id: buyerUser1.id, car_id: carA.id });
    await Wishlist.create({ user_id: buyerUser2.id, car_id: carA.id });

    res = await request(app)
      .get(`/api/v1/wishlists/car/${carA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET /wishlists/car/:carId returns 200 OK for owner', res.statusCode === 200);
    const wishlistsList = res.body.data?.wishlists || [];
    assert('Wishlists list has 2 entries', wishlistsList.length === 2);
    assert('Wishlist item contains user_name, user_phone, wishlisted_at', !!wishlistsList[0].user_name && !!wishlistsList[0].user_phone && !!wishlistsList[0].wishlisted_at);

    // Alias /api/v1/wishlist/car/:carId also works
    res = await request(app)
      .get(`/api/v1/wishlist/car/${carA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert('GET /wishlist/car/:carId (singular) returns 200 OK', res.statusCode === 200);

    // Unauthorized dealer access check
    res = await request(app)
      .get(`/api/v1/wishlists/car/${carA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert('Unauthorized dealer gets 404 for foreign car wishlists', res.statusCode === 404);

    // -------------------------------------------------------------------------
    // TEST 4: Leads Listing with Source Filtering (GET /api/v1/leads/car/:carId)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Leads Listing & Source Filtering ---');
    await Lead.create({
      car_id: carA.id,
      seller_id: dealerUserA.id,
      buyer_id: buyerUser1.id,
      buyer_name: buyerUser1.full_name,
      buyer_phone: buyerUser1.phone,
      source: 'whatsapp',
      status: 'new',
    });
    await Lead.create({
      car_id: carA.id,
      seller_id: dealerUserA.id,
      buyer_id: buyerUser2.id,
      buyer_name: buyerUser2.full_name,
      buyer_phone: buyerUser2.phone,
      source: 'call',
      status: 'new',
    });
    await Lead.create({
      car_id: carA.id,
      seller_id: dealerUserA.id,
      buyer_id: buyerUser1.id,
      buyer_name: buyerUser1.full_name,
      buyer_phone: buyerUser1.phone,
      source: 'message',
      status: 'new',
    });

    // All leads without filter
    res = await request(app)
      .get(`/api/v1/leads/car/${carA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET /leads/car/:carId returns 200 OK', res.statusCode === 200);
    let leadsList = res.body.data?.leads || [];
    assert('All leads count is 3', leadsList.length === 3);
    assert('Lead has buyer_name', !!leadsList[0].buyer_name);
    assert('Lead has buyer_phone', !!leadsList[0].buyer_phone);
    assert('Lead has interacted_at', !!leadsList[0].interacted_at);
    assert('Lead has source', !!leadsList[0].source);
    assert('Lead does NOT contain profile_pic', leadsList[0].profile_pic === undefined && leadsList[0].buyer_profile_pic === undefined);
    assert('Lead does NOT contain is_viewed', leadsList[0].is_viewed === undefined);

    // Filter by whatsapp
    res = await request(app)
      .get(`/api/v1/leads/car/${carA.id}?source=whatsapp`)
      .set('Authorization', `Bearer ${tokenA}`);
    leadsList = res.body.data?.leads || [];
    assert('Filter ?source=whatsapp returns exactly 1 lead', leadsList.length === 1);
    assert('Filtered lead has source "whatsapp"', leadsList[0].source === 'whatsapp');

    // Filter by call
    res = await request(app)
      .get(`/api/v1/leads/car/${carA.id}?source=call`)
      .set('Authorization', `Bearer ${tokenA}`);
    leadsList = res.body.data?.leads || [];
    assert('Filter ?source=call returns exactly 1 lead', leadsList.length === 1);
    assert('Filtered lead has source "call"', leadsList[0].source === 'call');

    // -------------------------------------------------------------------------
    // TEST 5: Empty Car Results
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Empty Car Results ---');
    res = await request(app)
      .get(`/api/v1/views/car/${emptyCar.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert('Empty car views returns empty array', res.body.data?.views?.length === 0);
    assert('Empty car views has_more is false', res.body.data?.pagination?.has_more === false);

    res = await request(app)
      .get(`/api/v1/wishlists/car/${emptyCar.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert('Empty car wishlists returns empty array', res.body.data?.wishlists?.length === 0);
    assert('Empty car wishlists has_more is false', res.body.data?.pagination?.has_more === false);

    res = await request(app)
      .get(`/api/v1/leads/car/${emptyCar.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert('Empty car leads returns empty array', res.body.data?.leads?.length === 0);
    assert('Empty car leads has_more is false', res.body.data?.pagination?.has_more === false);

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
    // Cleanup
    console.log('🧹 Cleaning up test records...');
    try {
      await View.destroy({ where: { car_id: [carA?.id, emptyCar?.id].filter(Boolean) } });
      await Wishlist.destroy({ where: { car_id: [carA?.id, emptyCar?.id].filter(Boolean) } });
      await Lead.destroy({ where: { car_id: [carA?.id, emptyCar?.id].filter(Boolean) } });
      if (carA) await Car.unscoped().destroy({ where: { id: carA.id } });
      if (emptyCar) await Car.unscoped().destroy({ where: { id: emptyCar.id } });
      if (variant) await variant.destroy();
      if (carModel) await carModel.destroy();
      if (brand) await brand.destroy();
      if (dealerUserA) await dealerUserA.destroy();
      if (dealerUserB) await dealerUserB.destroy();
      if (buyerUser1) await buyerUser1.destroy();
      if (buyerUser2) await buyerUser2.destroy();
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
