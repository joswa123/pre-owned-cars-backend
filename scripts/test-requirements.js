require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Requirement } = require('../src/models');

async function testSuite() {
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

  let userA, userB;
  let tokenA, tokenB;
  let brand1, brand2;
  let modelOfBrand1, modelOfBrand2;
  const createdReqIds = [];

  try {
    await sequelize.authenticate();
    console.log('🔌 Test DB connection established.');

    // 1. Setup Test Users
    console.log('👥 Creating test users...');
    const hashedPass = await bcrypt.hash('TestPassword123!', 12);
    
    // Cleanup any orphaned test users from previous failed runs
    await User.destroy({ where: { email: ['usera@test.com', 'userb@test.com'] } });

    userA = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'User A',
      phone: '9999900001',
      email: 'usera@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenA = jwt.sign({ id: userA.id, role: userA.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    userB = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'User B',
      phone: '9999900002',
      email: 'userb@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenB = jwt.sign({ id: userB.id, role: userB.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Fetch/create Brands & Models for validation
    console.log('🚗 Setting up brand/model catalog mappings...');
    brand1 = await Brand.findOne();
    if (!brand1) {
      brand1 = await Brand.create({ name: 'Brand One', logo: 'logo1.png' });
    }
    modelOfBrand1 = await Model.findOne({ where: { brandId: brand1.id } });
    if (!modelOfBrand1) {
      modelOfBrand1 = await Model.create({ name: 'Model One', brandId: brand1.id, body_type: 'Sedan' });
    }

    brand2 = await Brand.create({ id: require('crypto').randomUUID(), name: 'Brand Two', logo: 'logo2.png' });
    modelOfBrand2 = await Model.create({ id: require('crypto').randomUUID(), name: 'Model Two', brandId: brand2.id, body_type: 'SUV' });

    // ==========================================
    // TEST 1: JOI VALIDATION SCHEMA CHECKS
    // ==========================================
    console.log('\n═══ TEST 1: Joi Schema Validation ═══');

    // 1a. Missing brand_id
    let res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ purchase_plan_days: 30 });
    assert('Create Requirement fails on missing brand_id', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1b. Missing purchase_plan_days
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ brand_id: brand1.id });
    assert('Create Requirement fails on missing purchase_plan_days', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1c. Too long description (> 500 characters)
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: brand1.id,
        purchase_plan_days: 30,
        description: 'a'.repeat(501),
      });
    assert('Create Requirement fails when description is over 500 characters', res.statusCode === 400 && res.body.success === false, res.body.message);

    // ==========================================
    // TEST 2: INVALID UUIDs (BRAND / MODEL)
    // ==========================================
    console.log('\n═══ TEST 2: Invalid Catalog Entity UUIDs ═══');

    const fakeUuid = require('crypto').randomUUID();

    // 2a. Non-existent brand_id
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: fakeUuid,
        purchase_plan_days: 30,
      });
    assert('Create Requirement fails with 404 if brand_id does not exist', res.statusCode === 404, `got: ${res.statusCode} ${JSON.stringify(res.body)}`);

    // 2b. Non-existent model_id
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: brand1.id,
        model_id: fakeUuid,
        purchase_plan_days: 30,
      });
    assert('Create Requirement fails with 404 if model_id does not exist', res.statusCode === 404, `got: ${res.statusCode} ${JSON.stringify(res.body)}`);

    // ==========================================
    // TEST 3: MODEL-BRAND MISMATCH MAPPING
    // ==========================================
    console.log('\n═══ TEST 3: Model-Brand Mismatch Validation ═══');

    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: brand1.id,
        model_id: modelOfBrand2.id, // belongs to brand2
        purchase_plan_days: 30,
      });
    assert(
      'Create Requirement fails with 400 when model does not belong to brand',
      res.statusCode === 400 && res.body.message.includes('belong'),
      `got: ${res.statusCode} ${JSON.stringify(res.body)}`
    );

    // ==========================================
    // TEST 4: HAPPY CREATION FLOW
    // ==========================================
    console.log('\n═══ TEST 4: Happy Creation Path ═══');

    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: brand1.id,
        model_id: modelOfBrand1.id,
        year: 2020,
        price: 1000000,
        km: 30000,
        purchase_plan_days: 30,
        description: 'Valid test requirement',
      });

    assert('Create Requirement succeeds (201)', res.statusCode === 201);
    if (res.statusCode === 201) {
      const reqData = res.body.data;
      createdReqIds.push(reqData.id);
      assert('Requirement contains computed expiry_date', !!reqData.expiry_date);
      assert('Requirement brand details loaded', reqData.brand?.name === brand1.name);
      assert('Requirement model details loaded', reqData.carModel?.name === modelOfBrand1.name);
    }

    // ==========================================
    // TEST 5: RETRIEVAL & ON-THE-FLY EXPIRY FILTER
    // ==========================================
    console.log('\n═══ TEST 5: Retrieval & Dynamic Expiry ═══');

    // 5a. Get list
    res = await request(app)
      .get('/api/v1/requirements/me')
      .set('Authorization', `Bearer ${tokenA}`);
    assert('Get user requirements succeeds', res.statusCode === 200 && res.body.data.requirements.length === 1);

    // 5b. Create a requirement that is expired
    const expiredReq = await Requirement.create({
      user_id: userA.id,
      brand_id: brand1.id,
      purchase_plan_days: 10,
      expiry_date: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      status: 'active',
    });
    createdReqIds.push(expiredReq.id);

    // Get list with status=active filter. Should trigger dynamic expiry update and EXCLUDE it.
    res = await request(app)
      .get('/api/v1/requirements/me?status=active')
      .set('Authorization', `Bearer ${tokenA}`);
    assert('Active filter excludes dynamically expired requirements', res.statusCode === 200 && res.body.data.requirements.length === 1);

    // Confirm it changed to 'expired' in the DB
    const refreshedExpired = await Requirement.findByPk(expiredReq.id);
    assert('Requirement status updated to expired in DB', refreshedExpired.status === 'expired');

    // ==========================================
    // TEST 6: STATUS STATE TRANSITIONS
    // ==========================================
    console.log('\n═══ TEST 6: Status Update Transitions ═══');
    const targetReqId = createdReqIds[0];

    // 6a. Update to 'bought' without bought_from (should fail)
    res = await request(app)
      .patch(`/api/v1/requirements/${targetReqId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'bought' });
    assert("Marking status 'bought' without bought_from fails", res.statusCode === 400);

    // 6b. Update to 'bought' with bought_from (should succeed)
    res = await request(app)
      .patch(`/api/v1/requirements/${targetReqId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'bought', bought_from: 'OLX' });
    assert("Marking status 'bought' with bought_from succeeds", res.statusCode === 200 && res.body.data.status === 'bought' && res.body.data.bought_from === 'OLX');

    // 6c. Transition back to 'active' -> bought_from must clear to null
    res = await request(app)
      .patch(`/api/v1/requirements/${targetReqId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'active' });
    assert("Transition back to 'active' clears bought_from to null", res.statusCode === 200 && res.body.data.status === 'active' && res.body.data.bought_from === null);

    // ==========================================
    // TEST 7: ACCESS CONTROL
    // ==========================================
    console.log('\n═══ TEST 7: Access Control (Authorization) ═══');

    // User B tries to update User A's requirement
    res = await request(app)
      .patch(`/api/v1/requirements/${targetReqId}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'expired' });
    assert("User B is blocked from updating User A's requirement", res.statusCode === 404);

    // ==========================================
    // TEST 8: SOFT DELETION
    // ==========================================
    console.log('\n═══ TEST 8: Soft Deletion ═══');

    res = await request(app)
      .delete(`/api/v1/requirements/${targetReqId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert('Soft deletion succeeds (200)', res.statusCode === 200);

    // Verify it is excluded from default GET list
    res = await request(app)
      .get('/api/v1/requirements/me')
      .set('Authorization', `Bearer ${tokenA}`);
    const foundDeleted = res.body.data.requirements.find(r => r.id === targetReqId);
    assert('Soft-deleted requirement excluded from default retrieve list', !foundDeleted);

    // Verify it returns when status=deleted is requested
    res = await request(app)
      .get('/api/v1/requirements/me?status=deleted')
      .set('Authorization', `Bearer ${tokenA}`);
    const foundDeletedExplicit = res.body.data.requirements.find(r => r.id === targetReqId);
    assert('Soft-deleted requirement returns when status=deleted is filtered', !!foundDeletedExplicit && foundDeletedExplicit.status === 'deleted');

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n' + '═'.repeat(50));
    console.log('TEST SUITE SUMMARY');
    console.log('═'.repeat(50));
    results.forEach(r => console.log(r));
    console.log('═'.repeat(50));
    console.log(`\n  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Test error:', error);
    failed++;
  } finally {
    // 9. CLEANUP (Database sanitization)
    console.log('\n🧹 Cleaning up test users, brand, model, and requirements...');
    try {
      if (createdReqIds.length > 0) {
        await Requirement.destroy({ where: { id: createdReqIds } });
      }
      if (userA) await userA.destroy();
      if (userB) await userB.destroy();
      if (brand2) await brand2.destroy(); // modelOfBrand2 deleted automatically via cascade
      console.log('✅ Cleanup complete.');
    } catch (e) {
      console.error('⚠️ Cleanup warning:', e.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

testSuite();
