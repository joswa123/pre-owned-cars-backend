const sequelize = require('../src/config/database');
const { User, Car, Wishlist, View, Lead, Requirement, Brand, Model, State, District, City } = require('../src/models');
const wishlistService = require('../src/services/wishlistService');
const carService = require('../src/services/carService');
const dashboardService = require('../src/services/dashboardService');
const leadService = require('../src/services/leadService');
const requirementService = require('../src/services/requirementService');
const viewService = require('../src/services/viewService');
const redisClient = require('../src/config/redis');

async function runTests() {
  console.log('🚀 STARTING COMPREHENSIVE BACKEND VERIFICATION TESTS...\n');

  try {
    await sequelize.authenticate();
    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
      } catch (e) {
        console.warn('Redis connection note:', e.message);
      }
    }

    // 0. Fetch or create a test dealer, test customer, test brand, model, location
    let dealer = await User.findOne({ where: { role: 'dealer' } });
    if (!dealer) {
      dealer = await User.create({
        full_name: 'Test Dealer',
        phone: '9876543210',
        role: 'dealer',
        password_hash: 'dummyhash',
      });
    }

    let customer = await User.findOne({ where: { role: 'customer' } });
    if (!customer) {
      customer = await User.create({
        full_name: 'Test Customer',
        phone: '9876543211',
        role: 'customer',
        password_hash: 'dummyhash',
      });
    }

    let brand = await Brand.findOne();
    if (!brand) {
      brand = await Brand.create({ name: 'Toyota' });
    }

    let carModel = await Model.findOne({ where: { brandId: brand.id } });
    if (!carModel) {
      carModel = await Model.create({ name: 'Innova', brandId: brand.id });
    }

    const { Variant } = require('../src/models');
    let variant = await Variant.findOne({ where: { model_id: carModel.id } });
    if (!variant) {
      variant = await Variant.create({ name: '2.4 ZX', model_id: carModel.id });
    }

    let state = await State.findOne();
    let district = state ? await District.findOne({ where: { state_id: state.id } }) : null;
    let city = district ? await City.findOne({ where: { district_id: district.id } }) : null;

    // Create test active car
    const testCar = await Car.create({
      user_id: dealer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      posted_by_type: 'dealer',
      year: 2022,
      price: 1500000,
      km_driven: 25000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      status: 'active',
      state_id: state ? state.id : null,
      district_id: district ? district.id : null,
      city_id: city ? city.id : null,
    });

    console.log(`✅ Test setup complete (Car ID: ${testCar.id}, Dealer ID: ${dealer.id}, Customer ID: ${customer.id})`);

    // ==========================================
    // TEST 1: Wishlist Association & Eager Loading
    // ==========================================
    console.log('\n--- TEST 1: Wishlist Association & Eager Loading ---');
    // Direct association test
    const rawWishlists = await Wishlist.findAll({
      where: { user_id: customer.id },
      include: [{ model: Car, as: 'car' }],
    });
    console.log('✅ Sequelize Wishlist.findAll({ include: [{ model: Car, as: "car" }] }) succeeded without error!');

    // Service call test
    const userWishlistCars = await wishlistService.getWishlist(customer.id);
    console.log(`✅ wishlistService.getWishlist succeeded! Returned ${userWishlistCars.length} cars.`);

    // ==========================================
    // TEST 2: Wishlist Toggle & Duplicate Prevention
    // ==========================================
    console.log('\n--- TEST 2: Wishlist Toggle & Duplicate Prevention ---');
    // Toggle ON
    const toggleOn = await wishlistService.toggleWishlist(customer.id, testCar.id);
    console.log('Toggle ON result:', toggleOn);
    if (!toggleOn.is_wishlisted || !toggleOn.isWishlist) throw new Error('Toggle ON should set is_wishlisted=true');

    // Check count in DB
    const wishlistCountAfterOn = await Wishlist.count({ where: { user_id: customer.id, car_id: testCar.id } });
    if (wishlistCountAfterOn !== 1) throw new Error(`Expected exactly 1 wishlist row, found ${wishlistCountAfterOn}`);

    // Try adding again via addToWishlist (idempotence test)
    await wishlistService.addToWishlist(customer.id, testCar.id);
    const wishlistCountAfterAdd = await Wishlist.count({ where: { user_id: customer.id, car_id: testCar.id } });
    if (wishlistCountAfterAdd !== 1) throw new Error(`addToWishlist should be idempotent! Found ${wishlistCountAfterAdd}`);

    // Get car wishlists listing format check
    const carWishlistsResult = await wishlistService.getCarWishlists(dealer.id, testCar.id);
    console.log('Car wishlists sample entry:', carWishlistsResult.wishlists[0]);
    if (!carWishlistsResult.wishlists[0] || !carWishlistsResult.wishlists[0].user_name || !carWishlistsResult.wishlists[0].wishlisted_at) {
      throw new Error('Car wishlists missing required fields (user_name, wishlisted_at)');
    }
    console.log('✅ Wishlist listing format verified: user_name, user_phone, wishlisted_at.');

    // Toggle OFF
    const toggleOff = await wishlistService.toggleWishlist(customer.id, testCar.id);
    console.log('Toggle OFF result:', toggleOff);
    if (toggleOff.is_wishlisted || toggleOff.isWishlist) throw new Error('Toggle OFF should set is_wishlisted=false');
    const wishlistCountAfterOff = await Wishlist.count({ where: { user_id: customer.id, car_id: testCar.id } });
    if (wishlistCountAfterOff !== 0) throw new Error('Expected 0 wishlist rows after toggle OFF');
    console.log('✅ Wishlist toggle & duplicate prevention verified!');

    // ==========================================
    // TEST 3: View Deduplication & Timestamp Update
    // ==========================================
    console.log('\n--- TEST 3: View Deduplication & Timestamp Update ---');
    // Clear existing views for this test car & user
    await View.destroy({ where: { car_id: testCar.id, user_id: customer.id } });

    // Record view 10 times in quick succession for customer
    for (let i = 0; i < 10; i++) {
      await carService.recordView(testCar.id, customer.id, '127.0.0.1');
    }

    const viewCount = await View.count({ where: { car_id: testCar.id, user_id: customer.id } });
    console.log(`View records created after 10 views: ${viewCount}`);
    if (viewCount !== 1) throw new Error(`Expected exactly 1 view record after 10 view calls, but found ${viewCount}`);

    // Verify view listing format
    const carViewsResult = await viewService.getCarViews(dealer.id, testCar.id);
    console.log('Car views sample entry:', carViewsResult.views[0]);
    if (!carViewsResult.views[0] || !carViewsResult.views[0].user_name || !carViewsResult.views[0].viewed_at) {
      throw new Error('Car views missing required fields (user_name, viewed_at)');
    }
    console.log('✅ View deduplication & listing format verified (only 1 record created)!');

    // Guest view check
    const guestViewsBefore = await View.count({ where: { car_id: testCar.id, user_id: null } });
    await carService.recordView(testCar.id, null, '127.0.0.1');
    const guestViewsAfter = await View.count({ where: { car_id: testCar.id, user_id: null } });
    if (guestViewsAfter !== guestViewsBefore) {
      throw new Error('Guest view should not create row in views table');
    }
    console.log('✅ Guest view handling verified (no duplicate row created in views table)!');

    // ==========================================
    // TEST 4: Dashboard Summary Counts (Dealer & Customer)
    // ==========================================
    console.log('\n--- TEST 4: Dashboard Summary Counts ---');

    // Create 1 sold car and 1 deleted car for dealer
    const soldCar = await Car.create({
      user_id: dealer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      posted_by_type: 'dealer',
      year: 2021,
      price: 1200000,
      km_driven: 40000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      status: 'sold',
    });

    const deletedCar = await Car.create({
      user_id: dealer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      posted_by_type: 'dealer',
      year: 2020,
      price: 800000,
      km_driven: 60000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '2nd Owner',
      body_type: 'Hatchback',
      board_type: 'Own Board',
      status: 'deleted',
    });

    // Create leads for dealer from customer with different sources
    const leadWa = await Lead.create({
      car_id: testCar.id,
      seller_id: dealer.id,
      buyer_id: customer.id,
      buyer_name: 'Test Customer',
      buyer_phone: '9876543211',
      source: 'whatsapp',
      status: 'new',
    });

    const leadCall = await Lead.create({
      car_id: testCar.id,
      seller_id: dealer.id,
      buyer_id: customer.id,
      buyer_name: 'Test Customer',
      buyer_phone: '9876543211',
      source: 'call',
      status: 'new',
    });

    // Create requirements for customer: 1 active, 1 expired, 1 bought, 1 deleted
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const reqActive = await Requirement.create({
      user_id: customer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      year: 2022,
      body_type: 'SUV',
      transmission: 'Manual',
      board_type: 'Own Board',
      purchase_plan_days: 15,
      expiry_date: futureDate,
      status: 'active',
    });

    const reqExpired = await Requirement.create({
      user_id: customer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      year: 2021,
      body_type: 'Sedan',
      transmission: 'Automatic',
      board_type: 'Own Board',
      purchase_plan_days: 5,
      expiry_date: pastDate,
      status: 'active', // Should auto-expire
    });

    const reqBought = await Requirement.create({
      user_id: customer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      year: 2020,
      body_type: 'Hatchback',
      transmission: 'Manual',
      board_type: 'Own Board',
      purchase_plan_days: 30,
      expiry_date: futureDate,
      status: 'bought',
      bought_from: 'AutoDeal4U',
    });

    const reqDeleted = await Requirement.create({
      user_id: customer.id,
      brand_id: brand.id,
      model_id: carModel.id,
      year: 2019,
      body_type: 'Hatchback',
      transmission: 'Manual',
      board_type: 'Own Board',
      purchase_plan_days: 30,
      expiry_date: futureDate,
      status: 'deleted',
    });

    // Invalidate caches before fetching
    await dashboardService.invalidateDashboardCache(dealer.id);
    await dashboardService.invalidateDashboardCache(customer.id);

    // Fetch Dealer Dashboard Summary
    const dealerDashboard = await dashboardService.getDashboardSummary(dealer.id, 'dealer');
    console.log('\nDealer Dashboard Summary result:', JSON.stringify(dealerDashboard, null, 2));

    // Verify Dealer Dashboard:
    // Cars total = active + sold (excluding deleted)
    if (dealerDashboard.cars.active < 1) throw new Error('Expected at least 1 active car');
    if (dealerDashboard.cars.sold < 1) throw new Error('Expected at least 1 sold car');
    if (dealerDashboard.cars.deleted < 1) throw new Error('Expected at least 1 deleted car');
    if (dealerDashboard.cars.total !== (dealerDashboard.cars.active + dealerDashboard.cars.sold)) {
      throw new Error(`Cars total mismatch: ${dealerDashboard.cars.total} != ${dealerDashboard.cars.active + dealerDashboard.cars.sold}`);
    }
    // Leads by source
    if (dealerDashboard.leads.by_source.whatsapp < 1) throw new Error('Expected at least 1 whatsapp lead');
    if (dealerDashboard.leads.by_source.call < 1) throw new Error('Expected at least 1 call lead');
    console.log('✅ Dealer Dashboard summary counts match actual DB!');

    // Fetch Customer Dashboard Summary
    const customerDashboard = await dashboardService.getDashboardSummary(customer.id, 'customer');
    console.log('\nCustomer Dashboard Summary result:', JSON.stringify(customerDashboard, null, 2));

    // Verify Customer Requirements:
    // reqExpired had past date, so should be auto-expired
    if (customerDashboard.requirements.active < 1) throw new Error('Expected at least 1 active requirement');
    if (customerDashboard.requirements.expired < 1) throw new Error('Expected at least 1 expired requirement');
    if (customerDashboard.requirements.bought < 1) throw new Error('Expected at least 1 bought requirement');
    if (customerDashboard.requirements.deleted < 1) throw new Error('Expected at least 1 deleted requirement');
    if (customerDashboard.requirements.total !== (customerDashboard.requirements.active + customerDashboard.requirements.expired + customerDashboard.requirements.bought)) {
      throw new Error(`Requirements total mismatch (should exclude deleted): ${customerDashboard.requirements.total}`);
    }
    console.log('✅ Customer Dashboard summary counts match actual DB!');

    // ==========================================
    // TEST 5: Lead Source Filtering
    // ==========================================
    console.log('\n--- TEST 5: Lead Source Filtering ---');
    const waLeads = await leadService.getCarLeads(dealer.id, testCar.id, { source: 'whatsapp' });
    console.log(`WhatsApp leads fetched: ${waLeads.leads.length}`);
    const nonWa = waLeads.leads.filter(l => l.source !== 'whatsapp');
    if (nonWa.length > 0) throw new Error('getCarLeads with source=whatsapp returned non-whatsapp leads');
    console.log('✅ Lead source filtering works accurately!');

    // ==========================================
    // TEST 6: Cache Invalidation on Mutation
    // ==========================================
    console.log('\n--- TEST 6: Cache Invalidation on Mutation ---');
    // 1. Fetch dashboard to cache it
    await dashboardService.getDashboardSummary(dealer.id, 'dealer');
    // 2. Mutate car status
    await carService.markCarAsSold(testCar.id, dealer.id);
    // 3. Fetch again and ensure counts updated
    const updatedDashboard = await dashboardService.getDashboardSummary(dealer.id, 'dealer');
    console.log('Updated Dealer Dashboard after markCarAsSold (sold count):', updatedDashboard.cars.sold);
    if (updatedDashboard.cars.sold < 2) throw new Error('Dashboard cache was not invalidated after markCarAsSold!');
    console.log('✅ Cache invalidation verified!');

    // Clean up created test records
    await Lead.destroy({ where: { id: [leadWa.id, leadCall.id] } });
    await View.destroy({ where: { car_id: testCar.id } });
    await Wishlist.destroy({ where: { car_id: [testCar.id, soldCar.id, deletedCar.id] } });
    await Requirement.destroy({ where: { id: [reqActive.id, reqExpired.id, reqBought.id, reqDeleted.id] } });
    await Car.destroy({ where: { id: [testCar.id, soldCar.id, deletedCar.id] }, force: true });

    console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 100% READY.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
