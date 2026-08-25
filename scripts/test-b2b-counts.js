const sequelize = require('../src/config/database');
const { User, Car, Brand, Model, Variant } = require('../src/models');
const carService = require('../src/services/carService');
const redisClient = require('../src/config/redis');

async function testB2BCounts() {
  console.log('🚀 TESTING B2B COUNT ACCURACY & LIVE DB UPDATE WHEN CAR ADDED...\n');

  try {
    await sequelize.authenticate();
    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
      } catch (e) {}
    }
    if (redisClient.isOpen) {
      await redisClient.del('board_type_stats');
    }

    let dealer = await User.findOne({ where: { role: 'dealer' } });
    if (!dealer) {
      dealer = await User.create({
        full_name: 'B2B Test Dealer',
        phone: '9666111222',
        role: 'dealer',
        password_hash: 'dummyhash',
      });
    }

    let brand = await Brand.findOne({ where: { is_active: true } });
    if (!brand) {
      brand = await Brand.create({ name: 'Hyundai', is_active: true });
    }

    let carModel = await Model.findOne({ where: { brandId: brand.id } });
    if (!carModel) {
      carModel = await Model.create({ name: 'Creta', brandId: brand.id });
    }

    let variant = await Variant.findOne({ where: { model_id: carModel.id } });
    if (!variant) {
      variant = await Variant.create({ name: 'SX', model_id: carModel.id });
    }

    // Initial stats
    const initialStats = await carService.getBoardTypeStats();
    console.log('Initial stats before adding B2B car:', initialStats);
    const initialB2B = initialStats.B2B || 0;

    // Case 1: Add car with b2b_listing = true
    console.log('\n--- 1. Adding car with b2b_listing: true ---');
    const car1 = await carService.createCar(dealer.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2024,
      price: 1800000,
      km_driven: 8000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      b2b_listing: true,
      status: 'active',
      primary_image: 'b2b-car-1.jpg',
    });

    let statsAfterCar1 = await carService.getBoardTypeStats();
    console.log('Stats after Car 1:', statsAfterCar1);
    if (statsAfterCar1.B2B !== initialB2B + 1) {
      throw new Error(`Expected B2B count to be ${initialB2B + 1}, got ${statsAfterCar1.B2B}`);
    }
    console.log('✅ B2B count incremented correctly on Car 1 (b2b_listing: true)!');

    // Case 2: Add car with string 'b2b: true'
    console.log('\n--- 2. Adding car with b2b: "true" ---');
    const car2 = await carService.createCar(dealer.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2023,
      price: 1700000,
      km_driven: 12000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      b2b: 'true',
      status: 'active',
      primary_image: 'b2b-car-2.jpg',
    });

    let statsAfterCar2 = await carService.getBoardTypeStats();
    console.log('Stats after Car 2:', statsAfterCar2);
    if (statsAfterCar2.B2B !== initialB2B + 2) {
      throw new Error(`Expected B2B count to be ${initialB2B + 2}, got ${statsAfterCar2.B2B}`);
    }
    console.log('✅ B2B count incremented correctly on Car 2 (b2b: "true")!');

    // Case 3: Add car with board_type: 'B2B'
    console.log('\n--- 3. Adding car with board_type: "B2B" ---');
    const car3 = await carService.createCar(dealer.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2022,
      price: 1600000,
      km_driven: 20000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '2nd Owner',
      body_type: 'SUV',
      board_type: 'B2B',
      status: 'active',
      primary_image: 'b2b-car-3.jpg',
    });

    let statsAfterCar3 = await carService.getBoardTypeStats();
    console.log('Stats after Car 3:', statsAfterCar3);
    if (statsAfterCar3.B2B !== initialB2B + 3) {
      throw new Error(`Expected B2B count to be ${initialB2B + 3}, got ${statsAfterCar3.B2B}`);
    }
    console.log('✅ B2B count incremented correctly on Car 3 (board_type: "B2B")!');

    // Case 4: Update car from B2B to non-B2B
    console.log('\n--- 4. Updating Car 3 to non-B2B (b2b_listing: false) ---');
    await carService.updateCar(car3.id, dealer.id, {
      b2b_listing: false,
    });

    let statsAfterUpdate = await carService.getBoardTypeStats();
    console.log('Stats after updating Car 3:', statsAfterUpdate);
    if (statsAfterUpdate.B2B !== initialB2B + 2) {
      throw new Error(`Expected B2B count to be ${initialB2B + 2}, got ${statsAfterUpdate.B2B}`);
    }
    console.log('✅ B2B count decremented correctly on update!');

    // Case 5: Mark Car 1 as sold -> B2B count decrements
    console.log('\n--- 5. Marking Car 1 as SOLD ---');
    await carService.markCarAsSold(car1.id, dealer.id);

    let statsAfterSold = await carService.getBoardTypeStats();
    console.log('Stats after Car 1 sold:', statsAfterSold);
    if (statsAfterSold.B2B !== initialB2B + 1) {
      throw new Error(`Expected B2B count to be ${initialB2B + 1}, got ${statsAfterSold.B2B}`);
    }
    console.log('✅ B2B count decremented correctly when marked sold!');

    // Case 6: Delete Car 2 -> B2B count returns to initial
    console.log('\n--- 6. Deleting Car 2 ---');
    await carService.deleteCar(car2.id, dealer.id);

    let statsAfterDelete = await carService.getBoardTypeStats();
    console.log('Stats after Car 2 deleted:', statsAfterDelete);
    if (statsAfterDelete.B2B !== initialB2B) {
      throw new Error(`Expected B2B count to be ${initialB2B}, got ${statsAfterDelete.B2B}`);
    }
    console.log('✅ B2B count returned to initial state on delete!');

    // Clean up created records
    await Car.destroy({ where: { id: [car1.id, car2.id, car3.id] }, force: true });

    console.log('\n🎉 ALL B2B COUNT AND LOCAL DB UPDATE TESTS PASSED 100%!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

testB2BCounts();
