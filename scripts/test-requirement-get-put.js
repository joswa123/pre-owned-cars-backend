require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Brand, Model, Requirement } = require('../src/models');

async function runGetPutTests() {
  let passed = 0;
  let failed = 0;
  const testResults = [];

  const assert = (name, condition, detail = '') => {
    if (condition) {
      passed++;
      testResults.push({ name, status: 'PASSED', detail });
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      failed++;
      testResults.push({ name, status: 'FAILED', detail });
      console.error(`  ❌ [FAIL] ${name} ${detail ? `-> (${detail})` : ''}`);
    }
  };

  let userA, userB;
  let tokenA, tokenB;
  let brand1, brand2;
  let model1, model2;
  const createdReqIds = [];

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // 1. Setup Test Users
    console.log('👤 Setting up test users...');
    const hashedPass = await bcrypt.hash('Secret123!', 10);
    await User.destroy({ where: { email: ['get_put_user_a@test.com', 'get_put_user_b@test.com'] } });

    userA = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Requirement Owner A',
      phone: '9999700001',
      email: 'get_put_user_a@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenA = jwt.sign({ id: userA.id, role: userA.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    userB = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Requirement Stranger B',
      phone: '9999700002',
      email: 'get_put_user_b@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    tokenB = jwt.sign({ id: userB.id, role: userB.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Setup Brands and Models
    brand1 = await Brand.create({ id: require('crypto').randomUUID(), name: 'Test Brand Hyundai', logo: 'hyundai.png' });
    model1 = await Model.create({ id: require('crypto').randomUUID(), name: 'Creta', brandId: brand1.id, body_type: 'SUV' });

    brand2 = await Brand.create({ id: require('crypto').randomUUID(), name: 'Test Brand Honda', logo: 'honda.png' });
    model2 = await Model.create({ id: require('crypto').randomUUID(), name: 'City', brandId: brand2.id, body_type: 'Sedan' });

    console.log('\n======================================================');
    console.log('TEST SUITE: GET & PUT /requirements/:id');
    console.log('======================================================\n');

    // Initial Requirement for User A
    const reqRes = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: brand1.id,
        model_id: model1.id,
        body_type: 'SUV',
        transmission: 'Manual',
        board_type: 'OWN BOARD',
        year: 2020,
        price: 900000,
        km_driven: 35000,
        color: 'White',
        purchase_plan_days: 30,
        description: 'Original description',
      });

    assert('POST initial requirement succeeds (201)', reqRes.statusCode === 201);
    const targetReq = reqRes.body.data;
    createdReqIds.push(targetReq.id);

    // =========================================================================
    // SECTION 1: GET /requirements/:id
    // =========================================================================
    console.log('\n--- SECTION 1: GET /requirements/:id ---');

    // 1. GET own requirement -> 200 with full details
    let getRes = await request(app)
      .get(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET own requirement returns 200 OK', getRes.statusCode === 200, `Status: ${getRes.statusCode}`);
    assert('GET own requirement returns correct ID', getRes.body.data.id === targetReq.id);
    assert('GET own requirement returns populated brand', getRes.body.data.brand?.name === 'Test Brand Hyundai');
    assert('GET own requirement returns populated carModel', getRes.body.data.carModel?.name === 'Creta');

    // 2. GET another user's requirement -> 403 Unauthorized
    getRes = await request(app)
      .get(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    assert('GET another user requirement returns 403 Forbidden', getRes.statusCode === 403, `Status: ${getRes.statusCode}`);

    // 3. GET non-existent requirement -> 404 Not Found
    const nonExistentId = require('crypto').randomUUID();
    getRes = await request(app)
      .get(`/api/v1/requirements/${nonExistentId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert('GET non-existent requirement returns 404 Not Found', getRes.statusCode === 404, `Status: ${getRes.statusCode}`);

    // =========================================================================
    // SECTION 2: PUT /requirements/:id
    // =========================================================================
    console.log('\n--- SECTION 2: PUT /requirements/:id ---');

    // 4. PUT with no fields -> 400 Bad Request
    let putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    assert('PUT with empty body returns 400 Bad Request', putRes.statusCode === 400, `Status: ${putRes.statusCode}`);

    // 5. PUT update description only -> 200 OK
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: 'Updated looking for clean Creta' });

    assert('PUT update description returns 200 OK', putRes.statusCode === 200, `Status: ${putRes.statusCode}`);
    assert('Description is updated in response', putRes.body.data.description === 'Updated looking for clean Creta');

    // 6. PUT update year, price, km_driven, color -> 200 OK
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        year: 2022,
        price: 1150000,
        km_driven: 15000,
        color: 'Black',
      });

    assert('PUT update year, price, km_driven, color returns 200 OK', putRes.statusCode === 200, `Status: ${putRes.statusCode}`);
    assert('Year updated to 2022', putRes.body.data.year === 2022);
    assert('Price updated to 1150000', parseFloat(putRes.body.data.price) === 1150000);
    assert('Km driven updated to 15000', putRes.body.data.km_driven === 15000);
    assert('Color updated to Black', putRes.body.data.color === 'Black');

    // 7. PUT update purchase_plan_days -> expiry recalculated from created_at
    const initialCreatedDate = new Date(targetReq.created_at || targetReq.createdAt);
    const newDays = 60;
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ purchase_plan_days: newDays });

    assert('PUT update purchase_plan_days returns 200 OK', putRes.statusCode === 200, `Status: ${putRes.statusCode}`);
    const newExpiry = new Date(putRes.body.data.expiry_date);
    const expectedExpiry = new Date(initialCreatedDate.getTime() + newDays * 24 * 60 * 60 * 1000);
    const diffMs = Math.abs(newExpiry.getTime() - expectedExpiry.getTime());
    assert('Expiry date accurately recalculated from created_at + new purchase_plan_days', diffMs < 1000, `Diff: ${diffMs}ms`);

    // 8. PUT update brand_id with non-existent UUID -> 404
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ brand_id: nonExistentId });

    assert('PUT with non-existent brand_id returns 404', putRes.statusCode === 404, `Status: ${putRes.statusCode}`);

    // 9. PUT update model_id that doesn't belong to current/target brand -> 400
    // Currently requirement has brand1 (Hyundai), model2 is Honda City (brand2)
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ model_id: model2.id });

    assert('PUT with mismatched model_id returns 400 Bad Request', putRes.statusCode === 400, `Status: ${putRes.statusCode}`);

    // 10. PUT update both brand_id and model_id to matching brand2 + model2 -> 200 OK
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand_id: brand2.id,
        model_id: model2.id,
        body_type: 'Sedan',
      });

    assert('PUT update brand and model returns 200 OK', putRes.statusCode === 200, `Status: ${putRes.statusCode}`);
    assert('Brand updated to Honda', putRes.body.data.brand?.name === 'Test Brand Honda');
    assert('Model updated to City', putRes.body.data.carModel?.name === 'City');
    assert('Body type updated to Sedan', putRes.body.data.body_type === 'Sedan');

    // 11. PUT another user's requirement -> 403 Forbidden
    putRes = await request(app)
      .put(`/api/v1/requirements/${targetReq.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ description: 'Hacking description' });

    assert('PUT another user requirement returns 403 Forbidden', putRes.statusCode === 403, `Status: ${putRes.statusCode}`);

    // 12. PUT non-existent requirement -> 404 Not Found
    putRes = await request(app)
      .put(`/api/v1/requirements/${nonExistentId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: 'Updating nothing' });

    assert('PUT non-existent requirement returns 404 Not Found', putRes.statusCode === 404, `Status: ${putRes.statusCode}`);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n======================================================');
    console.log('GET & PUT ENDPOINTS TEST SUMMARY');
    console.log('======================================================');
    console.log(`Total Assertions: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Unexpected Error during test execution:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test users, brands, models, and requirements...');
    try {
      if (createdReqIds.length > 0) {
        await Requirement.destroy({ where: { id: createdReqIds } });
      }
      if (model1) await model1.destroy();
      if (model2) await model2.destroy();
      if (brand1) await brand1.destroy();
      if (brand2) await brand2.destroy();
      if (userA) await userA.destroy();
      if (userB) await userB.destroy();
      console.log('✅ Cleanup finished.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runGetPutTests();
