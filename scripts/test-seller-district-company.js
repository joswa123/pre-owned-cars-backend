require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, DealerProfile, State, District, City, Brand, Model, Variant, Car } = require('../src/models');

async function runSellerFieldsTests() {
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

  let state, district1, district2, city1, city2;
  let brand, carModel, variant;
  let dealerUser, customerUser, adminUser;
  let dealerProfile;
  let dealerToken, customerToken, adminToken;
  let dealerCar, customerCar;

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // 1. Setup State, Districts, Cities
    console.log('📍 Setting up location hierarchy...');
    state = await State.create({ id: require('crypto').randomUUID(), name: 'Seller Test State TN', code: 'TN_TST' });
    district1 = await District.create({ id: require('crypto').randomUUID(), name: 'Coimbatore', state_id: state.id });
    district2 = await District.create({ id: require('crypto').randomUUID(), name: 'Chennai', state_id: state.id });
    city1 = await City.create({ id: require('crypto').randomUUID(), name: 'Mettupalayam', district_id: district1.id, state_id: state.id });
    city2 = await City.create({ id: require('crypto').randomUUID(), name: 'Anna Nagar', district_id: district2.id, state_id: state.id });

    // 2. Setup Brand, Model, Variant
    brand = await Brand.create({ id: require('crypto').randomUUID(), name: 'Seller Test Brand BMW', logo: 'bmw.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: '3 Series', brandId: brand.id, body_type: 'Sedan' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: '330i', model_id: carModel.id });

    // 3. Setup Users
    console.log('👤 Setting up Dealer, Customer, and Admin users...');
    const hashedPass = await bcrypt.hash('Secret123!', 10);
    await User.destroy({ where: { email: ['test_dealer_seller@test.com', 'test_customer_seller@test.com', 'test_admin_seller@test.com'] } });

    dealerUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Test Dealer 01',
      phone: '9999400001',
      email: 'test_dealer_seller@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
      state_id: state.id,
      district_id: district1.id,
      city_id: city1.id,
      city: 'Mettupalayam',
      state: 'Seller Test State TN',
    });
    dealerToken = jwt.sign({ id: dealerUser.id, role: dealerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    dealerProfile = await DealerProfile.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUser.id,
      company_name: 'Premium Motors',
      door_no: '12',
      building_name: 'Auto Plaza',
      street_name: 'Dealer Main Road',
      pincode: '641301',
    });

    customerUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Test Customer 01',
      phone: '9999400002',
      email: 'test_customer_seller@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
      state_id: state.id,
      district_id: district2.id,
      city_id: city2.id,
      city: 'Anna Nagar',
      state: 'Seller Test State TN',
    });
    customerToken = jwt.sign({ id: customerUser.id, role: customerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    adminUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Test Admin 01',
      phone: '9999400003',
      email: 'test_admin_seller@test.com',
      password_hash: hashedPass,
      role: 'admin',
      is_verified: true,
    });
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 4. Create Cars
    console.log('🚗 Creating sample cars for Dealer and Customer...');
    dealerCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      state_id: state.id,
      district_id: district1.id,
      city_id: city1.id,
      year: 2023,
      price: 4500000,
      km_driven: 12000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'active',
    });

    customerCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: customerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      state_id: state.id,
      district_id: district2.id,
      city_id: city2.id,
      year: 2020,
      price: 3200000,
      km_driven: 40000,
      fuel_type: 'Diesel',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'customer',
      status: 'active',
    });

    console.log('\n======================================================');
    console.log('TEST SUITE: SELLER DISTRICT & COMPANY_NAME VERIFICATION');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/v1/cars/:id - Dealer Car Detail
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: GET /api/v1/cars/:id (Dealer Car) ---');
    let res = await request(app).get(`/api/v1/cars/${dealerCar.id}`);
    assert('GET /cars/:id (dealer) returns 200 OK', res.statusCode === 200, `Status: ${res.statusCode}`);
    let seller = res.body.data?.car?.seller;
    assert('Seller object exists on car', !!seller);
    assert('Seller district is "Coimbatore"', seller?.district === 'Coimbatore', `district: ${seller?.district}`);
    assert('Seller company_name is "Premium Motors"', seller?.company_name === 'Premium Motors', `company_name: ${seller?.company_name}`);
    assert('Nested dealerProfile is cleaned up', seller?.dealerProfile === undefined);

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/v1/cars/:id - Customer Car Detail
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: GET /api/v1/cars/:id (Customer Car) ---');
    res = await request(app).get(`/api/v1/cars/${customerCar.id}`);
    assert('GET /cars/:id (customer) returns 200 OK', res.statusCode === 200, `Status: ${res.statusCode}`);
    seller = res.body.data?.car?.seller;
    assert('Customer seller district is "Chennai"', seller?.district === 'Chennai', `district: ${seller?.district}`);
    assert('Customer seller company_name is null', seller?.company_name === null, `company_name: ${seller?.company_name}`);

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/v1/cars (List Endpoint)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: GET /api/v1/cars (List Endpoint) ---');
    res = await request(app).get(`/api/v1/cars?brands=${brand.id}`);
    assert('GET /cars returns 200 OK', res.statusCode === 200, `Status: ${res.statusCode}`);
    const carsList = res.body.data?.cars || [];
    const listDealerCar = carsList.find(c => c.id === dealerCar.id);
    const listCustomerCar = carsList.find(c => c.id === customerCar.id);
    
    assert('Dealer car found in list with seller.district="Coimbatore"', listDealerCar?.seller?.district === 'Coimbatore');
    assert('Dealer car found in list with seller.company_name="Premium Motors"', listDealerCar?.seller?.company_name === 'Premium Motors');
    assert('Customer car found in list with seller.district="Chennai"', listCustomerCar?.seller?.district === 'Chennai');
    assert('Customer car found in list with seller.company_name=null', listCustomerCar?.seller?.company_name === null);

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/v1/cars/featured (Featured Endpoint)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: GET /api/v1/cars/featured ---');
    res = await request(app).get('/api/v1/cars/featured');
    assert('GET /cars/featured returns 200 OK', res.statusCode === 200, `Status: ${res.statusCode}`);
    const featuredCars = res.body.data?.cars || [];
    const featuredDealerCar = featuredCars.find(c => c.id === dealerCar.id);
    if (featuredDealerCar) {
      assert('Featured dealer car has district="Coimbatore"', featuredDealerCar?.seller?.district === 'Coimbatore');
      assert('Featured dealer car has company_name="Premium Motors"', featuredDealerCar?.seller?.company_name === 'Premium Motors');
    } else {
      assert('Featured cars returned array', Array.isArray(featuredCars));
    }

    // -------------------------------------------------------------------------
    // TEST 5: GET /api/v1/cars/me (User Cars Endpoint)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: GET /api/v1/cars/me (Dealer User) ---');
    res = await request(app).get('/api/v1/cars/me').set('Authorization', `Bearer ${dealerToken}`);
    assert('GET /cars/me returns 200 OK', res.statusCode === 200, `Status: ${res.statusCode}`);
    const userCars = res.body.data?.cars || [];
    const myDealerCar = userCars.find(c => c.id === dealerCar.id);
    assert('Dealer my-cars listing has district="Coimbatore"', myDealerCar?.seller?.district === 'Coimbatore');
    assert('Dealer my-cars listing has company_name="Premium Motors"', myDealerCar?.seller?.company_name === 'Premium Motors');

    // -------------------------------------------------------------------------
    // TEST 6: GET /api/v1/admin/dealers/:dealerId/cars (Admin Dealer Cars Endpoint)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: GET /api/v1/admin/dealers/:dealerId/cars ---');
    res = await request(app).get(`/api/v1/admin/dealers/${dealerUser.id}/cars`).set('Authorization', `Bearer ${adminToken}`);
    assert('GET /admin/dealers/:dealerId/cars returns 200 OK', res.statusCode === 200, `Status: ${res.statusCode}`);
    const adminDealerCars = res.body.data?.cars || [];
    const adminDealerCar = adminDealerCars.find(c => c.id === dealerCar.id);
    assert('Admin dealer car listing has district="Coimbatore"', adminDealerCar?.seller?.district === 'Coimbatore');
    assert('Admin dealer car listing has company_name="Premium Motors"', adminDealerCar?.seller?.company_name === 'Premium Motors');

    // -------------------------------------------------------------------------
    // TEST 7: carService.getAdminCars (Service Method)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: carService.getAdminCars ---');
    const carService = require('../src/services/carService');
    const adminResult = await carService.getAdminCars({ posted_by_type: 'dealer' });
    const directAdminDealerCar = adminResult.cars?.find(c => c.id === dealerCar.id);
    assert('carService.getAdminCars returns cars array', Array.isArray(adminResult.cars));
    assert('carService.getAdminCars has dealer district="Coimbatore"', directAdminDealerCar?.seller?.district === 'Coimbatore');
    assert('carService.getAdminCars has dealer company_name="Premium Motors"', directAdminDealerCar?.seller?.company_name === 'Premium Motors');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n======================================================');
    console.log('SELLER DISTRICT & COMPANY_NAME TEST SUMMARY');
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
      if (dealerCar) await Car.unscoped().destroy({ where: { id: dealerCar.id } });
      if (customerCar) await Car.unscoped().destroy({ where: { id: customerCar.id } });
      if (variant) await variant.destroy();
      if (carModel) await carModel.destroy();
      if (brand) await brand.destroy();
      if (dealerProfile) await dealerProfile.destroy();
      if (dealerUser) await dealerUser.destroy();
      if (customerUser) await customerUser.destroy();
      if (adminUser) await adminUser.destroy();
      if (city1) await city1.destroy();
      if (city2) await city2.destroy();
      if (district1) await district1.destroy();
      if (district2) await district2.destroy();
      if (state) await state.destroy();
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runSellerFieldsTests();
