'use strict';

require('dotenv').config();
const sequelize = require('../src/config/database');
const highlightService = require('../src/services/highlightService');
const { Highlight, Car, CarHighlight, User, Brand, Model, Variant } = require('../src/models');

async function run() {
  console.log('🚀 Starting Highlight CRUD Integration Verification Script...');

  try {
    console.log('1. Authenticating DB connection...');
    await sequelize.authenticate();
    console.log('✅ DB connected successfully.');

    console.log('\n2. Testing getAllHighlights (includes cars_count)...');
    const all = await highlightService.getAllHighlights();
    console.log(`✅ Fetched ${all.length} highlights.`);
    if (all.length > 0) {
      console.log(`Sample highlight: id=${all[0].id}, name="${all[0].name}", cars_count=${all[0].cars_count} (type: ${typeof all[0].cars_count})`);
      if (typeof all[0].cars_count !== 'number') {
        throw new Error('cars_count is not an integer number!');
      }
    }

    console.log('\n3. Testing createHighlight with trimming and normalization...');
    const uniqueName = `Automatic Transmission ${Date.now()}`;
    const messyName = `   ${uniqueName.replace(' ', '   ')}   `;
    const created = await highlightService.createHighlight({ name: messyName, is_active: true });
    console.log(`✅ Created highlight: id=${created.id}, name="${created.name}", cars_count=${created.cars_count}`);
    if (created.name !== uniqueName) {
      throw new Error(`Expected normalized name "${uniqueName}", got "${created.name}"`);
    }

    console.log('\n4. Testing case-insensitive duplicate prevention (should return 409)...');
    try {
      await highlightService.createHighlight({ name: uniqueName.toLowerCase() });
      throw new Error('FAILED: Duplicate creation was allowed!');
    } catch (err) {
      if (err.statusCode === 409) {
        console.log(`✅ Duplicate correctly rejected with 409: "${err.message}"`);
      } else {
        throw new Error(`Expected 409, got ${err.statusCode}: ${err.message}`);
      }
    }

    console.log('\n5. Testing getHighlightById...');
    const fetched = await highlightService.getHighlightById(created.id);
    console.log(`✅ Fetched single highlight: id=${fetched.id}, cars_count=${fetched.cars_count}`);

    console.log('\n6. Testing PATCH (toggle is_active)...');
    const patched = await highlightService.patchHighlight(created.id, { is_active: false });
    console.log(`✅ Toggled status: is_active=${patched.is_active}`);
    if (patched.is_active !== false) {
      throw new Error('is_active was not updated to false!');
    }

    console.log('\n7. Testing PUT (rename highlight)...');
    const renamedName = `${uniqueName} Updated`;
    const renamed = await highlightService.updateHighlight(created.id, { name: renamedName });
    console.log(`✅ Renamed highlight: name="${renamed.name}"`);
    if (renamed.name !== renamedName) {
      throw new Error('Name was not renamed!');
    }

    console.log('\n8. Testing cars_count and Safe Delete with Car Association...');
    // Find or create an admin user
    let adminUser = await User.findOne({ where: { role: 'admin' } });
    if (!adminUser) {
      adminUser = await User.create({
        full_name: 'Test Super Admin',
        phone: '9888877771',
        email: 'testsuperadmin@test.com',
        password_hash: 'dummyhash',
        role: 'admin',
        is_verified: true,
      });
    }

    // Find any existing car or create one
    let testCar = await Car.findOne();
    if (!testCar) {
      const [brand] = await Brand.findOrCreate({ where: { name: 'Maruti' }, defaults: { name: 'Maruti' } });
      const [model] = await Model.findOrCreate({ where: { name: 'Swift' }, defaults: { name: 'Swift', brandId: brand.id } });
      const [variant] = await Variant.findOrCreate({ where: { name: 'VXI' }, defaults: { name: 'VXI', model_id: model.id } });
      testCar = await Car.create({
        user_id: adminUser.id,
        brand_id: brand.id,
        model_id: model.id,
        variant_id: variant.id,
        year: 2021,
        price: 600000,
        km_driven: 30000,
        fuel_type: 'Petrol',
        transmission: 'Manual',
        status: 'active',
        posted_by_type: 'customer',
      });
    }

    // Link car to highlight
    await CarHighlight.create({ car_id: testCar.id, highlight_id: created.id });
    console.log(`✅ Linked testCar (${testCar.id}) to highlight (${created.id})`);

    // Verify cars_count is 1
    const withCarCount = await highlightService.getHighlightById(created.id);
    console.log(`✅ cars_count with car linked: ${withCarCount.cars_count}`);
    if (withCarCount.cars_count !== 1) {
      throw new Error(`Expected cars_count=1, got ${withCarCount.cars_count}`);
    }

    console.log('\n9. Testing Safe Delete WITHOUT force (should return 409)...');
    try {
      await highlightService.deleteHighlight(created.id, false, adminUser);
      throw new Error('FAILED: Delete without force was allowed on highlight in use!');
    } catch (err) {
      if (err.statusCode === 409) {
        console.log(`✅ Safe delete prevented with 409: "${err.message}"`);
      } else {
        throw new Error(`Expected 409, got ${err.statusCode}: ${err.message}`);
      }
    }

    console.log('\n10. Testing Force Delete (force=true)...');
    const forceDelResult = await highlightService.deleteHighlight(created.id, true, adminUser);
    console.log(`✅ Force delete result:`, forceDelResult);

    // Verify highlight is deleted
    const checkH = await Highlight.findByPk(created.id);
    if (checkH !== null) throw new Error('Highlight was not deleted after force delete!');

    // Verify junction row is deleted
    const checkJunction = await CarHighlight.findOne({ where: { car_id: testCar.id, highlight_id: created.id } });
    if (checkJunction !== null) throw new Error('CarHighlight junction was not deleted after force delete!');

    // Verify car still exists!
    const checkCar = await Car.findByPk(testCar.id);
    if (!checkCar) throw new Error('CRITICAL FAILURE: Car was deleted during highlight force delete!');
    console.log(`✅ CASCADE INVARIANCE CONFIRMED: Car ${testCar.id} is still completely intact!`);

    console.log('\n🎉 ALL HIGHLIGHT CRUD STEPS & SAFETY CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error);
    process.exit(1);
  }
}

run();
