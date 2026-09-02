require('dotenv').config({ override: true });
const sequelize = require('../src/config/database');
const { Brand, Model, Variant, Car, CarImage, User, State, District, City } = require('../src/models');
const { createCarSchema, updateCarSchema, mapToDbValues } = require('../src/validations/carValidation');
const carService = require('../src/services/carService');

async function runTests() {
  let testCarId = null;
  let testUserId = null;
  let passed = 0;
  let failed = 0;
  const results = [];

  const assert = (label, condition, detail = '') => {
    if (condition) {
      passed++;
      results.push(`  ✅ ${label}`);
    } else {
      failed++;
      results.push(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    }
  };

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected.\n');

    // ===== SETUP: Get existing brand/model/variant and user =====
    const variant = await Variant.findOne();
    const model = variant ? await Model.findByPk(variant.model_id) : null;
    const brand = model ? await Brand.findByPk(model.brandId || model.brand_id) : null;
    const user = (await User.findOne({ where: { role: 'dealer' } })) || (await User.findOne());
    const city = await City.findOne();
    const district = city ? await District.findByPk(city.district_id) : null;
    const state = district ? await State.findByPk(district.state_id) : null;

    if (!brand || !model || !variant || !user) {
      console.error('❌ Missing prerequisite data (brand/model/variant/user). Cannot run tests.');
      process.exit(1);
    }

    testUserId = user.id;
    console.log(`📋 Test Data:`);
    console.log(`   Brand: ${brand.name} (${brand.id})`);
    console.log(`   Model: ${model.name} (${model.id})`);
    console.log(`   Variant: ${variant.name} (${variant.id})`);
    console.log(`   User: ${user.full_name} (${user.id})`);
    if (city) console.log(`   City: ${city.name} (${city.id})`);
    console.log('');

    // ===== TEST 1: CREATE CAR VALIDATION =====
    console.log('═══ TEST 1: Create Car Validation ═══');

    // 1a: Valid create data
    const validCreateData = {
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2024,
      price: 500000,
      km_driven: 10000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      insurance_type: 'Comprehensive',
      color: 'Red',
      number_plate: 'TN-01-AB-1234',
      description: 'Test car for validation',
    };
    const createResult = createCarSchema.validate(validCreateData);
    assert('Create: Valid data passes validation', !createResult.error, createResult.error?.message);

    // 1b: Missing brand_id should fail
    const { brand_id, ...noBrand } = validCreateData;
    const noBrandResult = createCarSchema.validate(noBrand);
    assert('Create: Missing brand_id fails validation', !!noBrandResult.error, noBrandResult.error?.message);

    // 1c: Missing model_id should fail
    const { model_id, ...noModel } = validCreateData;
    const noModelResult = createCarSchema.validate(noModel);
    assert('Create: Missing model_id fails validation', !!noModelResult.error, noModelResult.error?.message);

    // 1d: Missing variant_id should fail
    const { variant_id, ...noVariant } = validCreateData;
    const noVariantResult = createCarSchema.validate(noVariant);
    assert('Create: Missing variant_id fails validation', !!noVariantResult.error, noVariantResult.error?.message);

    // 1e: board_type with different cases
    for (const bt of ['Own Board', 'own board', 'OWN BOARD', 'T-Board', 't-board', 'Commercial', 'commercial']) {
      const data = { ...validCreateData, board_type: bt };
      const result = createCarSchema.validate(data);
      assert(`Create: board_type "${bt}" passes validation`, !result.error, result.error?.message);
    }

    // ===== TEST 2: UPDATE CAR VALIDATION =====
    console.log('\n═══ TEST 2: Update Car Validation ═══');

    for (const bt of ['Own Board', 'own board', 'OWN BOARD', 'T-Board', 't-board', 'Commercial', 'commercial']) {
      const data = { board_type: bt };
      const result = updateCarSchema.validate(data);
      assert(`Update: board_type "${bt}" passes validation`, !result.error, result.error?.message);
    }

    const updateFuel = updateCarSchema.validate({ fuel_type: 'Diesel' });
    assert('Update: fuel_type "Diesel" passes', !updateFuel.error, updateFuel.error?.message);

    const updateTrans = updateCarSchema.validate({ transmission: 'Automatic' });
    assert('Update: transmission "Automatic" passes', !updateTrans.error, updateTrans.error?.message);

    // ===== TEST 3: mapToDbValues =====
    console.log('\n═══ TEST 3: mapToDbValues Mapping ═══');

    const mapped = mapToDbValues({
      board_type: 'own board',
      fuel_type: 'petrol',
      transmission: 'manual',
      ownership: '1st owner',
      insurance_type: 'comprehensive',
      body_type: 'sedan',
    });
    assert('Map: board_type "own board" → "Own Board"', mapped.board_type === 'Own Board', `got: "${mapped.board_type}"`);
    assert('Map: fuel_type "petrol" → "Petrol"', mapped.fuel_type === 'Petrol', `got: "${mapped.fuel_type}"`);
    assert('Map: transmission "manual" → "Manual"', mapped.transmission === 'Manual', `got: "${mapped.transmission}"`);
    assert('Map: ownership → "1st Owner"', mapped.ownership === '1st Owner', `got: "${mapped.ownership}"`);
    assert('Map: insurance_type → "Comprehensive"', mapped.insurance_type === 'Comprehensive', `got: "${mapped.insurance_type}"`);
    assert('Map: body_type "sedan" → "Sedan"', mapped.body_type === 'Sedan', `got: "${mapped.body_type}"`);

    const mappedTBoard = mapToDbValues({ board_type: 't-board' });
    assert('Map: board_type "t-board" → "T-Board"', mappedTBoard.board_type === 'T-Board', `got: "${mappedTBoard.board_type}"`);

    const mappedCommercial = mapToDbValues({ board_type: 'commercial' });
    assert('Map: board_type "commercial" → "Commercial"', mappedCommercial.board_type === 'Commercial', `got: "${mappedCommercial.board_type}"`);

    // ===== TEST 4: CREATE CAR (service layer) =====
    console.log('\n═══ TEST 4: Create Car (Service) ═══');

    const newCar = await carService.createCar(testUserId, validCreateData, null);
    testCarId = newCar.id;
    assert('Create: Car created successfully', !!testCarId);
    assert('Create: brand association present', !!newCar.brand, `brand: ${JSON.stringify(newCar.brand)}`);
    assert('Create: carModel association present', !!newCar.carModel, `carModel: ${JSON.stringify(newCar.carModel)}`);
    assert('Create: carVariant association present', !!newCar.carVariant, `carVariant: ${JSON.stringify(newCar.carVariant)}`);
    assert('Create: board_type stored correctly', newCar.board_type === 'Own Board', `got: "${newCar.board_type}"`);

    // ===== TEST 5: GET CARS LIST =====
    console.log('\n═══ TEST 5: GET Cars List ═══');

    const carsList = await carService.getCars({}, 1, 20, 'created_at', 'DESC');
    assert('GET List: Returns cars array', Array.isArray(carsList.cars));
    assert('GET List: Total > 0', carsList.total > 0, `total: ${carsList.total}`);

    const testCar = carsList.cars.find(c => c.id === testCarId);
    assert('GET List: Test car found in list', !!testCar);
    if (testCar) {
      assert('GET List: brand object present', !!testCar.brand && !!testCar.brand.name, `brand: ${JSON.stringify(testCar.brand)}`);
      assert('GET List: carModel object present', !!testCar.carModel && !!testCar.carModel.name, `carModel: ${JSON.stringify(testCar.carModel)}`);
      assert('GET List: carVariant object present', !!testCar.carVariant && !!testCar.carVariant.name, `carVariant: ${JSON.stringify(testCar.carVariant)}`);
      assert('GET List: model name is correct', testCar.carModel?.name === model.name, `expected: "${model.name}", got: "${testCar.carModel?.name}"`);
      assert('GET List: variant name is correct', testCar.carVariant?.name === variant.name, `expected: "${variant.name}", got: "${testCar.carVariant?.name}"`);
      assert('GET List: board_type is "Own Board"', testCar.board_type === 'Own Board', `got: "${testCar.board_type}"`);
    }

    // ===== TEST 6: GET CAR BY ID =====
    console.log('\n═══ TEST 6: GET Car By ID ═══');

    const carDetail = await carService.getCarById(testCarId);
    assert('GET Detail: Car found', !!carDetail);
    if (carDetail) {
      assert('GET Detail: brand present', !!carDetail.brand && !!carDetail.brand.name);
      assert('GET Detail: carModel present', !!carDetail.carModel && !!carDetail.carModel.name, `carModel: ${JSON.stringify(carDetail.carModel)}`);
      assert('GET Detail: carVariant present', !!carDetail.carVariant && !!carDetail.carVariant.name, `carVariant: ${JSON.stringify(carDetail.carVariant)}`);
      assert('GET Detail: state present', !!carDetail.state || carDetail.state_id === null, `state: ${JSON.stringify(carDetail.state)}`);
      assert('GET Detail: district present', !!carDetail.district || carDetail.district_id === null, `district: ${JSON.stringify(carDetail.district)}`);
      assert('GET Detail: city present', !!carDetail.city || carDetail.city_id === null, `city: ${JSON.stringify(carDetail.city)}`);
    }

    // ===== TEST 7: UPDATE CAR =====
    console.log('\n═══ TEST 7: Update Car ═══');

    // 7a: Update board_type with different cases
    const updatedCar1 = await carService.updateCar(testCarId, testUserId, { board_type: 't-board' }, null);
    assert('Update: board_type "t-board" → "T-Board"', updatedCar1.board_type === 'T-Board', `got: "${updatedCar1.board_type}"`);

    const updatedCar2 = await carService.updateCar(testCarId, testUserId, { board_type: 'commercial' }, null);
    assert('Update: board_type "commercial" → "Commercial"', updatedCar2.board_type === 'Commercial', `got: "${updatedCar2.board_type}"`);

    const updatedCar3 = await carService.updateCar(testCarId, testUserId, { board_type: 'Own Board' }, null);
    assert('Update: board_type "Own Board" → "Own Board"', updatedCar3.board_type === 'Own Board', `got: "${updatedCar3.board_type}"`);

    // 7b: Update price
    const updatedPrice = await carService.updateCar(testCarId, testUserId, { price: 600000 }, null);
    assert('Update: price changed to 600000', updatedPrice.price === 600000 || updatedPrice.price === '600000', `got: ${updatedPrice.price}`);

    // 7c: Update response has model/variant associations
    assert('Update Response: carModel present', !!updatedPrice.carModel && !!updatedPrice.carModel.name, `carModel: ${JSON.stringify(updatedPrice.carModel)}`);
    assert('Update Response: carVariant present', !!updatedPrice.carVariant && !!updatedPrice.carVariant.name, `carVariant: ${JSON.stringify(updatedPrice.carVariant)}`);

    // ===== TEST 8: DELETE CAR =====
    console.log('\n═══ TEST 8: Delete Car ═══');

    const deleteResult = await carService.deleteCar(testCarId, testUserId);
    assert('Delete: Returns success', deleteResult.success === true);

    // Verify it no longer appears in active list
    const afterDeleteList = await carService.getCars({}, 1, 100, 'created_at', 'DESC');
    const deletedCar = afterDeleteList.cars.find(c => c.id === testCarId);
    assert('Delete: Car not in active list', !deletedCar);

    testCarId = null; // Already cleaned up

    // ===== SUMMARY =====
    console.log('\n' + '═'.repeat(50));
    console.log('TEST RESULTS');
    console.log('═'.repeat(50));
    results.forEach(r => console.log(r));
    console.log('═'.repeat(50));
    console.log(`\n  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('═'.repeat(50));

    if (failed > 0) {
      console.log('\n⚠️  Some tests failed! Review the issues above.');
    } else {
      console.log('\n🎉 ALL TESTS PASSED!');
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup: if test car still exists, delete it
    if (testCarId) {
      try {
        await Car.update({ status: 'deleted', deleted_at: new Date() }, { where: { id: testCarId } });
        console.log(`🧹 Cleaned up test car: ${testCarId}`);
      } catch (e) {
        console.error(`⚠️ Failed to clean up test car: ${e.message}`);
      }
    }
    process.exit(0);
  }
}

runTests();
