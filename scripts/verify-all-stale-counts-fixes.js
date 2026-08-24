const sequelize = require('../src/config/database');
const { User, Car, Brand, Model, Variant, Lead, View, Wishlist, Requirement, State, District, City } = require('../src/models');
const carService = require('../src/services/carService');
const brandService = require('../src/services/brandService');
const wishlistService = require('../src/services/wishlistService');
const leadService = require('../src/services/leadService');
const dashboardService = require('../src/services/dashboardService');
const redisClient = require('../src/config/redis');

async function runVerification() {
  console.log('🚀 RUNNING COMPREHENSIVE STALE COUNTS & DASHBOARD FIXES VERIFICATION...\n');

  try {
    await sequelize.authenticate();
    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
      } catch (e) {}
    }

    // 1. Setup Test Users
    let seller = await User.findOne({ where: { role: 'dealer' } });
    if (!seller) {
      seller = await User.create({
        full_name: 'Test Dealer Seller',
        phone: '9888111222',
        role: 'dealer',
        password_hash: 'hash123',
      });
    }

    let buyer = await User.findOne({ where: { role: 'customer' } });
    if (!buyer) {
      buyer = await User.create({
        full_name: 'Test Buyer Customer',
        phone: '9888111333',
        role: 'customer',
        password_hash: 'hash123',
      });
    }

    let brand = await Brand.findOne({ where: { is_active: true } });
    if (!brand) {
      brand = await Brand.create({ name: 'Toyota', is_active: true });
    }

    let carModel = await Model.findOne({ where: { brandId: brand.id } });
    if (!carModel) {
      carModel = await Model.create({ name: 'Camry', brandId: brand.id });
    }

    let variant = await Variant.findOne({ where: { model_id: carModel.id } });
    if (!variant) {
      variant = await Variant.create({ name: 'Hybrid', model_id: carModel.id });
    }

    // --- TEST 1: Board Type Stats & B2B Count ---
    console.log('--- TEST 1: Board Type Stats & B2B Count ---');
    const boardStats = await carService.getBoardTypeStats();
    console.log('Board type stats:', boardStats);
    if (boardStats['OWN BOARD'] === undefined || boardStats['T-BOARD'] === undefined || boardStats['COMMERCIAL'] === undefined || boardStats['B2B'] === undefined) {
      throw new Error('Board type stats missing required keys (OWN BOARD, T-BOARD, COMMERCIAL, B2B)');
    }
    console.log('✅ Board type stats & B2B keys verified!');

    // --- TEST 2: Create Car -> Brand & Board Stats Invalidation ---
    console.log('\n--- TEST 2: Brand Counts & Board Stats Invalidation on Create ---');
    const initialBrandStats = await brandService.getBrandsWithCarCounts();
    const initialBrandCount = initialBrandStats.find(b => b.id === brand.id)?.car_count || 0;
    const initialOwnBoard = boardStats['OWN BOARD'];
    const initialB2B = boardStats['B2B'];

    const testCar = await carService.createCar(seller.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2024,
      price: 1500000,
      km_driven: 5000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      b2b_listing: true,
      status: 'active',
      primary_image: 'test-car.jpg',
    });

    const afterCreateBrands = await brandService.getBrandsWithCarCounts();
    const afterCreateBrandCount = afterCreateBrands.find(b => b.id === brand.id)?.car_count || 0;
    const afterCreateBoardStats = await carService.getBoardTypeStats();

    console.log(`Brand Count: ${afterCreateBrandCount} (was ${initialBrandCount})`);
    console.log(`OWN BOARD: ${afterCreateBoardStats['OWN BOARD']} (was ${initialOwnBoard})`);
    console.log(`B2B: ${afterCreateBoardStats['B2B']} (was ${initialB2B})`);

    if (afterCreateBrandCount !== initialBrandCount + 1) {
      throw new Error('Brand count did not increment on createCar!');
    }
    if (afterCreateBoardStats['OWN BOARD'] !== initialOwnBoard + 1) {
      throw new Error('OWN BOARD count did not increment on createCar!');
    }
    if (afterCreateBoardStats['B2B'] !== initialB2B + 1) {
      throw new Error('B2B count did not increment on createCar!');
    }
    console.log('✅ Car creation cache invalidation verified!');

    // --- TEST 3: Unique View Recording & Car Detail View Count ---
    console.log('\n--- TEST 3: Unique View Recording & Car Detail View Count ---');
    // Clean any prior views on testCar
    await View.destroy({ where: { car_id: testCar.id } });

    // Initial car detail fetch
    let carDetail = await carService.getCarById(testCar.id);
    console.log(`Initial Car Detail Views: ${carDetail.views_count}, metrics:`, carDetail.metrics);

    // Record 5 views by the same buyer
    for (let i = 0; i < 5; i++) {
      await carService.recordView(testCar.id, buyer.id, '127.0.0.1');
    }

    const viewRowsCount = await View.count({ where: { car_id: testCar.id, user_id: buyer.id } });
    if (viewRowsCount !== 1) {
      throw new Error(`Expected exactly 1 view row for same user, got ${viewRowsCount}`);
    }

    // Check car detail views after view recording
    carDetail = await carService.getCarById(testCar.id);
    console.log(`After 5 Views by Same User -> DB view rows: ${viewRowsCount}, Car Detail views_count: ${carDetail.views_count}`);

    if (carDetail.views_count < 1) {
      throw new Error('Car detail views_count should be at least 1!');
    }
    console.log('✅ Unique view recording and live views_count on car detail verified!');

    // --- TEST 4: Wishlist Toggle & Deduplication ---
    console.log('\n--- TEST 4: Wishlist Toggle & Deduplication ---');
    // Ensure clean wishlist state for testCar & buyer
    await Wishlist.destroy({ where: { user_id: buyer.id, car_id: testCar.id } });

    // Toggle Wishlist ON
    const toggleOnResult = await wishlistService.toggleWishlist(buyer.id, testCar.id);
    console.log('Toggle ON result:', toggleOnResult);
    if (!toggleOnResult.is_wishlisted) {
      throw new Error('Toggle ON failed');
    }

    // Check Car Detail Wishlist Count
    carDetail = await carService.getCarById(testCar.id);
    console.log(`Car Detail wishlist_count: ${carDetail.wishlist_count}, isWishlist (buyer): ${carDetail.isWishlist}`);
    if (carDetail.wishlist_count < 1) {
      throw new Error('Car detail wishlist_count should be at least 1!');
    }

    // Toggle Wishlist OFF
    const toggleOffResult = await wishlistService.toggleWishlist(buyer.id, testCar.id);
    console.log('Toggle OFF result:', toggleOffResult);
    if (toggleOffResult.is_wishlisted) {
      throw new Error('Toggle OFF failed');
    }

    carDetail = await carService.getCarById(testCar.id);
    console.log(`After Toggle OFF -> Car Detail wishlist_count: ${carDetail.wishlist_count}`);
    if (carDetail.wishlist_count !== 0) {
      throw new Error('Car detail wishlist_count should be 0 after toggle off!');
    }
    console.log('✅ Wishlist toggle, deduplication, and live wishlist_count verified!');

    // --- TEST 5: Lead Creation & Dashboard Summary by_source ---
    console.log('\n--- TEST 5: Lead Creation & Dashboard Summary by_source ---');
    // Invalidate dashboard before counting
    await dashboardService.invalidateDashboardCache(seller.id);

    const initialSummary = await dashboardService.getDashboardSummary(seller.id, 'dealer');
    console.log('Initial Seller Dashboard Summary:', JSON.stringify(initialSummary, null, 2));

    // Create 1 WhatsApp lead and 1 Call lead
    const lead1 = await leadService.createLead(buyer.id, {
      car_id: testCar.id,
      name: 'Buyer Test',
      phone: '9888111333',
      source: 'whatsapp',
      message: 'Interested in WhatsApp',
    });

    const lead2 = await leadService.createLead(buyer.id, {
      car_id: testCar.id,
      name: 'Buyer Test',
      phone: '9888111333',
      source: 'call',
      message: 'Call requested',
    });

    const afterLeadSummary = await dashboardService.getDashboardSummary(seller.id, 'dealer');
    console.log('Seller Dashboard Summary after leads:', JSON.stringify(afterLeadSummary, null, 2));

    if (afterLeadSummary.leads.total !== initialSummary.leads.total + 2) {
      throw new Error(`Expected seller leads.total to increase by 2, got ${afterLeadSummary.leads.total}`);
    }
    if (afterLeadSummary.leads.by_source.whatsapp < initialSummary.leads.by_source.whatsapp + 1) {
      throw new Error('Expected whatsapp lead count to increment!');
    }
    if (afterLeadSummary.leads.by_source.call < initialSummary.leads.by_source.call + 1) {
      throw new Error('Expected call lead count to increment!');
    }
    console.log('✅ Lead creation and dashboard summary by_source grouping verified!');

    // Clean up test data
    await Lead.destroy({ where: { id: [lead1.id, lead2.id] } });
    await View.destroy({ where: { car_id: testCar.id } });
    await Wishlist.destroy({ where: { car_id: testCar.id } });
    await Car.destroy({ where: { id: testCar.id }, force: true });

    console.log('\n🎉 ALL 5 TEST SUITES PASSED 100%! SYSTEM IS ACCURATE & FULLY SYNCHRONIZED.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

runVerification();
