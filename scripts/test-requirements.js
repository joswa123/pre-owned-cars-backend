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

    const validBasePayload = {
      brand_id: brand1.id,
      model_id: modelOfBrand1.id,
      body_type: 'Sedan',
      transmission: 'Automatic',
      board_type: 'OWN BOARD',
      purchase_plan_days: 30,
    };

    // 1a. Missing brand_id
    let res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, brand_id: undefined });
    assert('Create Requirement fails on missing brand_id', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1b. Missing model_id
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, model_id: undefined });
    assert('Create Requirement fails on missing model_id', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1c. Missing body_type
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, body_type: undefined });
    assert('Create Requirement fails on missing body_type', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1d. Missing transmission
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, transmission: undefined });
    assert('Create Requirement fails on missing transmission', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1e. Missing board_type
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, board_type: undefined });
    assert('Create Requirement fails on missing board_type', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1f. Missing purchase_plan_days
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, purchase_plan_days: undefined });
    assert('Create Requirement fails on missing purchase_plan_days', res.statusCode === 400 && res.body.success === false, res.body.message);

    // 1g. Too long description (> 500 characters)
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, description: 'a'.repeat(501) });
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
      .send({ ...validBasePayload, brand_id: fakeUuid });
    assert('Create Requirement fails with 404 if brand_id does not exist', res.statusCode === 404, `got: ${res.statusCode} ${JSON.stringify(res.body)}`);

    // 2b. Non-existent model_id
    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, model_id: fakeUuid });
    assert('Create Requirement fails with 404 if model_id does not exist', res.statusCode === 404, `got: ${res.statusCode} ${JSON.stringify(res.body)}`);

    // ==========================================
    // TEST 3: MODEL-BRAND MISMATCH MAPPING
    // ==========================================
    console.log('\n═══ TEST 3: Model-Brand Mismatch Validation ═══');

    res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validBasePayload, model_id: modelOfBrand2.id });
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
        min_year: 2018,
        max_year: 2023,
        min_price: 500000,
        max_price: 1500000,
        min_km: 10000,
        max_km: 50000,
        body_type: 'Sedan',
        transmission: 'Automatic',
        board_type: 'OWN BOARD',
        color: 'Blue Metallic',
        purchase_plan_days: 30,
        description: 'Valid test requirement with ranges and color',
      });

    assert('Create Requirement succeeds (201)', res.statusCode === 201);
    if (res.statusCode === 201) {
      const reqData = res.body.data;
      createdReqIds.push(reqData.id);
      assert('Requirement contains ranges & color correctly saved', reqData.min_year === 2018 && reqData.color === 'Blue Metallic');
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
      model_id: modelOfBrand1.id,
      body_type: 'Sedan',
      transmission: 'Automatic',
      board_type: 'OWN BOARD',
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
      .send({ status: 'bought', bought_from: 'Friend Recommendation' });
    assert("Marking status 'bought' with bought_from succeeds", res.statusCode === 200 && res.body.data.status === 'bought' && res.body.data.bought_from === 'Friend Recommendation');

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
    // TEST 8: ADMIN ENDPOINT & FILTERS
    // ==========================================
    console.log('\n═══ TEST 8: Admin Endpoint & Filters ═══');

    // 8a. User B (Customer role) tries to fetch all requirements -> Expect 403
    res = await request(app)
      .get('/api/v1/admin/requirements')
      .set('Authorization', `Bearer ${tokenB}`);
    assert('Customer blocked from admin view requirements', res.statusCode === 403);

    // Make User B an Admin in the database and re-sign JWT token with admin role
    await userB.update({ role: 'admin' });
    const adminToken = jwt.sign({ id: userB.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 8b. Fetch as Admin -> Expect 200
    res = await request(app)
      .get('/api/v1/admin/requirements')
      .set('Authorization', `Bearer ${adminToken}`);
    assert('Admin can fetch all platform requirements', res.statusCode === 200 && res.body.data.total >= 2);
    if (res.statusCode === 200) {
      const records = res.body.data.requirements;
      const verifiedRecord = records.find(r => r.id === targetReqId);
      assert('Requirement contains user details nested', !!verifiedRecord?.user?.full_name);
      assert('Requirement contains brand details nested', !!verifiedRecord?.brand?.name);
    }

    // 8c. Filter by status = 'active'
    res = await request(app)
      .get(`/api/v1/admin/requirements?status=active`)
      .set('Authorization', `Bearer ${adminToken}`);
    const activeReqs = res.body.data.requirements;
    assert('Admin filter by status active works', res.statusCode === 200 && activeReqs.every(r => r.status === 'active'));

    // 8d. Filter by user_id = userA.id
    res = await request(app)
      .get(`/api/v1/admin/requirements?user_id=${userA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const userReqs = res.body.data.requirements;
    assert('Admin filter by user_id works', res.statusCode === 200 && userReqs.every(r => r.user_id === userA.id));

    // 8e. Filter by date range (created_at)
    const todayStr = new Date().toISOString().split('T')[0];
    res = await request(app)
      .get(`/api/v1/admin/requirements?start_date=${todayStr}&end_date=${todayStr}T23:59:59.999Z`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert('Admin filter by created_at date ranges works', res.statusCode === 200 && res.body.data.requirements.length >= 2);

    // ==========================================
    // TEST 9: SOFT DELETION
    // ==========================================
    console.log('\n═══ TEST 9: Soft Deletion ═══');

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
    // 10. CLEANUP (Database sanitization)
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
