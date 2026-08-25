const sequelize = require('../src/config/database');
const { User, Car, Brand, Model, Variant, State, District, City } = require('../src/models');
const carService = require('../src/services/carService');
const brandService = require('../src/services/brandService');
const redisClient = require('../src/config/redis');

async function testCacheInvalidation() {
  console.log('🚀 TESTING BRAND & BOARD TYPE CACHE INVALIDATION...\n');

  try {
    await sequelize.authenticate();
    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
      } catch (e) {
        console.warn('Redis connect note:', e.message);
      }
    }

    // Find test dealer, brand, model, variant
    let dealer = await User.findOne({ where: { role: 'dealer' } });
    if (!dealer) {
      dealer = await User.create({
        full_name: 'Cache Test Dealer',
        phone: '9876543999',
        role: 'dealer',
        password_hash: 'dummyhash',
      });
    }

    let brand = await Brand.findOne({ where: { is_active: true } });
    if (!brand) {
      brand = await Brand.create({ name: 'Honda', is_active: true });
    }

    let carModel = await Model.findOne({ where: { brandId: brand.id } });
    if (!carModel) {
      carModel = await Model.create({ name: 'City', brandId: brand.id });
    }

    let variant = await Variant.findOne({ where: { model_id: carModel.id } });
    if (!variant) {
      variant = await Variant.create({ name: 'VX', model_id: carModel.id });
    }

    let state = await State.findOne();
    let district = state ? await District.findOne({ where: { state_id: state.id } }) : null;
    let city = district ? await City.findOne({ where: { district_id: district.id } }) : null;

    // STEP 1: Fetch initial counts and ensure they are cached
    const initialBrands = await brandService.getBrandsWithCarCounts();
    const initialBrandCount = (initialBrands.find(b => b.id === brand.id)?.car_count) || 0;

    const initialBoardStats = await carService.getBoardTypeStats();
    const initialOwnBoardCount = initialBoardStats['OWN BOARD'] || 0;

    console.log(`Initial Counts -> Brand (${brand.name}): ${initialBrandCount}, Board (OWN BOARD): ${initialOwnBoardCount}`);

    // Verify cache keys exist in Redis
    if (redisClient.isOpen) {
      const cachedBrand = await redisClient.get('brands:with_counts');
      const cachedBoard = await redisClient.get('board_type_stats');
      if (!cachedBrand || !cachedBoard) {
        throw new Error('Expected brands:with_counts and board_type_stats to be cached in Redis');
      }
      console.log('✅ Confirmed Redis cache keys exist (brands:with_counts, board_type_stats).');
    }

    // STEP 2: CREATE CAR -> Check cache invalidation
    console.log('\n--- 1. Testing createCar cache invalidation ---');
    const createdCar = await carService.createCar(dealer.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2023,
      price: 1000000,
      km_driven: 10000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      status: 'active',
      state_id: state ? state.id : null,
      district_id: district ? district.id : null,
      city_id: city ? city.id : null,
      primary_image: 'test-primary.jpg',
    });

    // Check counts immediately
    const brandsAfterCreate = await brandService.getBrandsWithCarCounts();
    const brandCountAfterCreate = (brandsAfterCreate.find(b => b.id === brand.id)?.car_count) || 0;

    const boardStatsAfterCreate = await carService.getBoardTypeStats();
    const ownBoardAfterCreate = boardStatsAfterCreate['OWN BOARD'] || 0;

    console.log(`After Create -> Brand (${brand.name}): ${brandCountAfterCreate} (expected ${initialBrandCount + 1}), Board: ${ownBoardAfterCreate} (expected ${initialOwnBoardCount + 1})`);

    if (brandCountAfterCreate !== initialBrandCount + 1) {
      throw new Error(`Brand count did not increment after createCar! Got ${brandCountAfterCreate}, expected ${initialBrandCount + 1}`);
    }
    if (ownBoardAfterCreate !== initialOwnBoardCount + 1) {
      throw new Error(`Board count did not increment after createCar! Got ${ownBoardAfterCreate}, expected ${initialOwnBoardCount + 1}`);
    }
    console.log('✅ createCar invalidated cache successfully!');

    // STEP 3: UPDATE CAR (Change board type to T-Board) -> Check cache invalidation
    console.log('\n--- 2. Testing updateCar cache invalidation ---');
    const initialTBoardCount = boardStatsAfterCreate['T-BOARD'] || 0;

    await carService.updateCar(createdCar.id, dealer.id, {
      board_type: 'T-Board',
    });

    const boardStatsAfterUpdate = await carService.getBoardTypeStats();
    console.log(`After Update Board Type -> OWN BOARD: ${boardStatsAfterUpdate['OWN BOARD']}, T-BOARD: ${boardStatsAfterUpdate['T-BOARD']}`);

    if (boardStatsAfterUpdate['OWN BOARD'] !== ownBoardAfterCreate - 1) {
      throw new Error('OWN BOARD count did not decrement after updating to T-Board');
    }
    if (boardStatsAfterUpdate['T-BOARD'] !== initialTBoardCount + 1) {
      throw new Error('T-BOARD count did not increment after updating to T-Board');
    }
    console.log('✅ updateCar invalidated cache successfully!');

    // STEP 4: MARK CAR AS SOLD -> Active count decreases
    console.log('\n--- 3. Testing markCarAsSold cache invalidation ---');
    await carService.markCarAsSold(createdCar.id, dealer.id);

    const brandsAfterSold = await brandService.getBrandsWithCarCounts();
    const brandCountAfterSold = (brandsAfterSold.find(b => b.id === brand.id)?.car_count) || 0;

    const boardStatsAfterSold = await carService.getBoardTypeStats();
    const tBoardAfterSold = boardStatsAfterSold['T-BOARD'] || 0;

    console.log(`After Sold -> Brand: ${brandCountAfterSold} (expected ${initialBrandCount}), T-BOARD: ${tBoardAfterSold} (expected ${initialTBoardCount})`);

    if (brandCountAfterSold !== initialBrandCount) {
      throw new Error(`Brand count did not decrement after markCarAsSold! Got ${brandCountAfterSold}, expected ${initialBrandCount}`);
    }
    if (tBoardAfterSold !== initialTBoardCount) {
      throw new Error(`T-BOARD count did not decrement after markCarAsSold! Got ${tBoardAfterSold}, expected ${initialTBoardCount}`);
    }
    console.log('✅ markCarAsSold invalidated cache successfully!');

    // STEP 5: UPDATE STATUS BACK TO ACTIVE -> Counts increase again
    console.log('\n--- 4. Testing updateCarStatus cache invalidation ---');
    await carService.updateCarStatus(createdCar.id, 'active', dealer.id);

    const brandsAfterReactive = await brandService.getBrandsWithCarCounts();
    const brandCountAfterReactive = (brandsAfterReactive.find(b => b.id === brand.id)?.car_count) || 0;

    if (brandCountAfterReactive !== initialBrandCount + 1) {
      throw new Error(`Brand count did not increment after updateCarStatus to active! Got ${brandCountAfterReactive}, expected ${initialBrandCount + 1}`);
    }
    console.log('✅ updateCarStatus invalidated cache successfully!');

    // STEP 6: DELETE CAR (Soft delete) -> Counts decrease
    console.log('\n--- 5. Testing deleteCar cache invalidation ---');
    await carService.deleteCar(createdCar.id, dealer.id);

    const brandsAfterDelete = await brandService.getBrandsWithCarCounts();
    const brandCountAfterDelete = (brandsAfterDelete.find(b => b.id === brand.id)?.car_count) || 0;

    const boardStatsAfterDelete = await carService.getBoardTypeStats();
    const tBoardAfterDelete = boardStatsAfterDelete['T-BOARD'] || 0;

    console.log(`After Delete -> Brand: ${brandCountAfterDelete} (expected ${initialBrandCount}), T-BOARD: ${tBoardAfterDelete} (expected ${initialTBoardCount})`);

    if (brandCountAfterDelete !== initialBrandCount) {
      throw new Error(`Brand count did not decrement after deleteCar! Got ${brandCountAfterDelete}, expected ${initialBrandCount}`);
    }
    if (tBoardAfterDelete !== initialTBoardCount) {
      throw new Error(`T-BOARD count did not decrement after deleteCar! Got ${tBoardAfterDelete}, expected ${initialTBoardCount}`);
    }
    console.log('✅ deleteCar invalidated cache successfully!');

    // Clean up hard record
    await Car.destroy({ where: { id: createdCar.id }, force: true });

    console.log('\n🎉 ALL CACHE INVALIDATION TESTS PASSED 100%!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CACHE INVALIDATION TEST FAILED:', err);
    process.exit(1);
  }
}

testCacheInvalidation();
