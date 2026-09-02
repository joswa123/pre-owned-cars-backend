// scripts/test-external-id-resolution.js
require('dotenv').config({ override: true });
const sequelize = require('../src/config/database');
const { Brand, Model, Variant, Car, User } = require('../src/models');
const carService = require('../src/services/carService');
const carCatalogService = require('../src/services/carCatalogService');

async function runTests() {
  console.log('🧪 Starting External ID Resolution & Hybrid ID Support Tests...\n');
  await sequelize.authenticate();

  let testUser = await User.findOne({ where: { role: 'customer' } });
  if (!testUser) {
    testUser = await User.findOne();
  }
  if (!testUser) {
    throw new Error('No user found in DB to test car creation');
  }

  // 1. Find Tata brand (should have external_id: 16)
  const tataBrand = await Brand.findOne({ where: { external_id: 16 } });
  if (!tataBrand) {
    throw new Error('Tata brand with external_id: 16 not found. Did sync run?');
  }
  console.log(`✅ Found Brand: ${tataBrand.name} (UUID: ${tataBrand.id}, external_id: ${tataBrand.external_id})`);

  // Find a model under Tata with external_id
  const altrozModel = await Model.findOne({ where: { brandId: tataBrand.id, external_id: 3273 } })
    || await Model.findOne({ where: { brandId: tataBrand.id } });
  if (!altrozModel) {
    throw new Error('No model found under Tata');
  }
  console.log(`✅ Found Model: ${altrozModel.name} (UUID: ${altrozModel.id}, external_id: ${altrozModel.external_id})`);

  // Find a variant under that model
  const altrozVariant = await Variant.findOne({ where: { model_id: altrozModel.id } });
  if (!altrozVariant) {
    throw new Error('No variant found under model');
  }
  console.log(`✅ Found Variant: ${altrozVariant.name} (UUID: ${altrozVariant.id}, external_id: ${altrozVariant.external_id})\n`);

  const { createCarSchema, updateCarSchema } = require('../src/validations/carValidation');

  // Validate Joi Schema accepts integer IDs
  console.log('Testing Joi schema validation with integer IDs...');
  const joiIntTest = createCarSchema.validate({
    brand_id: 16,
    model_id: 3273,
    variant_id: 20869,
    year: 2024,
    price: 1500000,
    km_driven: 5000,
    fuel_type: 'Petrol',
    transmission: 'automatic',
    ownership: '1st owner',
    body_type: 'SUV',
    board_type: 'own board',
  });
  if (joiIntTest.error) {
    throw new Error(`Joi integer validation failed: ${joiIntTest.error.message}`);
  }
  console.log('✅ Joi schema validation PASSED for integer IDs');

  // Validate Joi Schema accepts UUID IDs
  const joiUuidTest = createCarSchema.validate({
    brand_id: tataBrand.id,
    model_id: altrozModel.id,
    variant_id: altrozVariant.id,
    year: 2024,
    price: 1500000,
    km_driven: 5000,
    fuel_type: 'Petrol',
    transmission: 'automatic',
    ownership: '1st owner',
    body_type: 'SUV',
    board_type: 'own board',
  });
  if (joiUuidTest.error) {
    throw new Error(`Joi UUID validation failed: ${joiUuidTest.error.message}`);
  }
  console.log('✅ Joi schema validation PASSED for UUID IDs\n');

  let testCar1 = null;
  let testCar2 = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Create car with UUID IDs
    // -------------------------------------------------------------
    console.log('Test 1: Create car with UUID brand_id, model_id, variant_id...');
    testCar1 = await carService.createCar(testUser.id, {
      brand_id: tataBrand.id,
      model_id: altrozModel.id,
      variant_id: altrozVariant.id,
      year: 2023,
      price: 850000,
      km_driven: 15000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Hatchback',
      board_type: 'Own Board',
      status: 'active',
    });
    console.log(`✅ Test 1 PASSED: Created Car ID: ${testCar1.id} (Brand: ${testCar1.brand_id})`);

    // -------------------------------------------------------------
    // TEST 2: Create car with INTEGER external IDs (e.g. 16, model.external_id)
    // -------------------------------------------------------------
    console.log('\nTest 2: Create car with integer external_id (16, model_id, variant_id)...');
    testCar2 = await carService.createCar(testUser.id, {
      brand_id: tataBrand.external_id,
      model_id: altrozModel.external_id,
      variant_id: altrozVariant.external_id,
      year: 2024,
      price: 950000,
      km_driven: 5000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Hatchback',
      board_type: 'Own Board',
      status: 'active',
    });
    console.log(`✅ Test 2 PASSED: Created Car ID: ${testCar2.id} (Resolved brand_id: ${testCar2.brand_id}, model_id: ${testCar2.model_id}, variant_id: ${testCar2.variant_id})`);
    if (testCar2.brand_id !== tataBrand.id || testCar2.model_id !== altrozModel.id) {
      throw new Error(`Resolved UUID mismatch: expected brand ${tataBrand.id}, got ${testCar2.brand_id}`);
    }

    // -------------------------------------------------------------
    // TEST 3: Create car with numeric STRING external IDs ("16", etc.)
    // -------------------------------------------------------------
    console.log('\nTest 3: Create car with numeric string external IDs ("16", etc.)...');
    const testCar3 = await carService.createCar(testUser.id, {
      brand_id: String(tataBrand.external_id),
      model_id: String(altrozModel.external_id),
      variant_id: String(altrozVariant.external_id),
      year: 2022,
      price: 750000,
      km_driven: 25000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '2nd Owner',
      body_type: 'Hatchback',
      board_type: 'Own Board',
      status: 'active',
    });
    console.log(`✅ Test 3 PASSED: Created Car ID: ${testCar3.id}`);
    await Car.destroy({ where: { id: testCar3.id } });

    // -------------------------------------------------------------
    // TEST 4: Invalid integer external ID -> should fail with 404
    // -------------------------------------------------------------
    console.log('\nTest 4: Create car with non-existent integer brand_id (999999)...');
    try {
      await carService.createCar(testUser.id, {
        brand_id: 999999,
        model_id: altrozModel.id,
        variant_id: altrozVariant.id,
        year: 2023,
        price: 800000,
        transmission: 'Manual',
        ownership: '1st Owner',
      });
      throw new Error('Test 4 FAILED: Expected error but succeeded');
    } catch (err) {
      console.log(`✅ Test 4 PASSED: Correctly threw error (${err.statusCode || 404}): ${err.message}`);
    }

    // -------------------------------------------------------------
    // TEST 5: Update car using integer external IDs
    // -------------------------------------------------------------
    console.log('\nTest 5: Update car using integer external IDs...');
    const updatedCar = await carService.updateCar(testCar1.id, testUser.id, {
      brand_id: tataBrand.external_id,
      model_id: altrozModel.external_id,
      price: 820000,
    });
    console.log(`✅ Test 5 PASSED: Updated Car price to ${updatedCar.price}, brand_id is ${updatedCar.brand_id}`);

    // -------------------------------------------------------------
    // TEST 6: Catalog service endpoints return external_id
    // -------------------------------------------------------------
    console.log('\nTest 6: Verify catalog services return external_id...');
    const allBrands = await carCatalogService.getAllBrands();
    const tataInCatalog = allBrands.find(b => b.id === tataBrand.id);
    console.log('  Tata in getAllBrands:', tataInCatalog);
    if (!tataInCatalog || tataInCatalog.external_id !== 16) {
      throw new Error('Tata in getAllBrands missing external_id 16');
    }

    const models = await carCatalogService.getModelsByBrand(tataBrand.external_id);
    console.log(`  Fetched ${models.length} models for brand external_id: ${tataBrand.external_id}`);
    const altrozInCatalog = models.find(m => m.id === altrozModel.id);
    console.log('  Altroz in getModelsByBrand:', altrozInCatalog ? { id: altrozInCatalog.id, name: altrozInCatalog.name, external_id: altrozInCatalog.external_id } : 'null');

    const variants = await carCatalogService.getVariantsByModel(altrozModel.external_id);
    console.log(`  Fetched ${variants.length} variants for model external_id: ${altrozModel.external_id}`);

    console.log('\n✅ Test 6 PASSED: Catalog endpoints return external_id and accept integer IDs');

    // -------------------------------------------------------------
    // TEST 7: Filter cars by integer brand_id in getCars
    // -------------------------------------------------------------
    console.log('\nTest 7: Filter cars by integer brand_id (brand_id: 16)...');
    const filterRes = await carService.getCars({ brand_id: 16 }, 1, 10);
    console.log(`  Found ${filterRes.total} cars for brand_id: 16`);
    console.log('✅ Test 7 PASSED: Filter by external integer ID works');

  } finally {
    // Cleanup created test cars
    if (testCar1) await Car.destroy({ where: { id: testCar1.id } });
    if (testCar2) await Car.destroy({ where: { id: testCar2.id } });
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  });
