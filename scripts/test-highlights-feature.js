require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const { User, Car, Highlight, Brand, Model, Variant } = require('../src/models');

async function runTests() {
  console.log('🧪 Starting Car Highlights Feature Tests...\n');

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // 1. Get or create an admin and a regular user
    let adminUser = await User.findOne({ where: { role: 'admin' } });
    if (!adminUser) {
      adminUser = await User.findOne(); // fallback
    }

    let customerUser = await User.findOne({ where: { role: 'customer' } }) || adminUser;

    const adminToken = jwt.sign(
      { id: adminUser.id, role: 'admin' },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      { expiresIn: '1d' }
    );

    const userToken = jwt.sign(
      { id: customerUser.id, role: customerUser.role || 'customer' },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      { expiresIn: '1d' }
    );

    // ── Test 1: Public GET /api/v1/highlights ──
    console.log('▶️ Test 1: Public GET /api/v1/highlights');
    const res1 = await request(app).get('/api/v1/highlights');
    console.log(`Status: ${res1.status}`);
    if (res1.status !== 200 || !Array.isArray(res1.body.data) || res1.body.data.length === 0) {
      throw new Error(`Failed to fetch public highlights: ${JSON.stringify(res1.body)}`);
    }
    console.log(`✅ Fetched ${res1.body.data.length} active highlights from /api/v1/highlights (Sample: "${res1.body.data[0].name}")`);
    const availableHighlights = res1.body.data;
    const testHighlightIds = [availableHighlights[0].id, availableHighlights[1].id];

    // ── Test 2: Public GET /api/v1/car-highlights ──
    console.log('\n▶️ Test 2: Public GET /api/v1/car-highlights');
    const res2 = await request(app).get('/api/v1/car-highlights');
    console.log(`Status: ${res2.status}`);
    if (res2.status !== 200 || !Array.isArray(res2.body.data) || res2.body.data.length === 0) {
      throw new Error(`Failed to fetch public car-highlights: ${JSON.stringify(res2.body)}`);
    }
    console.log(`✅ Fetched ${res2.body.data.length} active highlights from /api/v1/car-highlights`);

    // ── Test 3: Admin GET /api/v1/admin/highlights ──
    console.log('\n▶️ Test 3: Admin GET /api/v1/admin/highlights');
    const res3 = await request(app)
      .get('/api/v1/admin/highlights')
      .set('Authorization', `Bearer ${adminToken}`);
    console.log(`Status: ${res3.status}`);
    if (res3.status !== 200 || !Array.isArray(res3.body.data)) {
      throw new Error(`Admin highlights fetch failed: ${JSON.stringify(res3.body)}`);
    }
    console.log(`✅ Admin fetched ${res3.body.data.length} highlights`);

    // ── Test 4: Rejection of Invalid Highlight ID during Car Creation ──
    console.log('\n▶️ Test 4: POST /api/v1/cars with invalid highlight_ids (Expect 400)');
    let brand = await Brand.findOne();
    let model = await Model.findOne({ where: { brandId: brand.id } });
    let variant = model ? await Variant.findOne({ where: { model_id: model.id } }) : null;

    const invalidCarPayload = {
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant ? variant.id : undefined,
      year: 2022,
      price: 650000,
      km_driven: 25000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      primary_image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341',
      highlight_ids: ['00000000-0000-0000-0000-000000000000'],
    };

    const res4 = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${userToken}`)
      .send(invalidCarPayload);

    console.log(`Status: ${res4.status} (Message: ${res4.body?.message})`);
    if (res4.status !== 400) {
      throw new Error(`Expected 400 for invalid highlight ID, got ${res4.status}`);
    }
    console.log('✅ Correctly rejected invalid highlight ID on car creation');

    // ── Test 5: Create Car with Valid highlight_ids ──
    console.log('\n▶️ Test 5: POST /api/v1/cars with valid highlight_ids');
    const newCarPayload = {
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant ? variant.id : undefined,
      year: 2022,
      price: 650000,
      km_driven: 25000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      primary_image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341',
      highlight_ids: testHighlightIds,
      description: 'Well maintained car with premium highlights',
    };

    const res5 = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${userToken}`)
      .send(newCarPayload);

    console.log(`Status: ${res5.status}`);
    if (res5.status !== 200 || !res5.body.data?.car?.id) {
      throw new Error(`Failed to create car with highlights: ${JSON.stringify(res5.body)}`);
    }

    const createdCar = res5.body.data.car;
    console.log(`✅ Car created successfully with ID: ${createdCar.id}`);
    console.log(`   Highlights in create response: ${JSON.stringify(createdCar.highlights)}`);
    if (!Array.isArray(createdCar.highlights) || createdCar.highlights.length !== 2) {
      throw new Error('Highlights array not populated in create response');
    }

    // ── Test 6: GET /api/v1/cars/:id ──
    console.log('\n▶️ Test 6: GET /api/v1/cars/:id (Detail includes highlights)');
    const res6 = await request(app).get(`/api/v1/cars/${createdCar.id}`);
    console.log(`Status: ${res6.status}`);
    if (res6.status !== 200 || !res6.body.data?.car?.highlights) {
      throw new Error(`Failed to fetch car detail: ${JSON.stringify(res6.body)}`);
    }
    const fetchedHighlights = res6.body.data.car.highlights;
    console.log(`✅ Fetched car details with highlights:`, fetchedHighlights);
    if (fetchedHighlights.length !== 2) {
      throw new Error(`Expected 2 highlights, got ${fetchedHighlights.length}`);
    }

    // ── Test 7: GET /api/v1/cars (List includes highlights) ──
    console.log('\n▶️ Test 7: GET /api/v1/cars (List includes highlights)');
    const res7 = await request(app).get('/api/v1/cars?limit=10');
    console.log(`Status: ${res7.status}`);
    if (res7.status !== 200 || !Array.isArray(res7.body.data?.cars)) {
      throw new Error(`Failed to get cars list: ${JSON.stringify(res7.body)}`);
    }
    const carInList = res7.body.data.cars.find(c => c.id === createdCar.id);
    if (carInList) {
      console.log(`✅ Created car found in cars list with ${carInList.highlights?.length} highlights`);
      if (!Array.isArray(carInList.highlights) || carInList.highlights.length !== 2) {
        throw new Error('Highlights in car list item incorrect');
      }
    } else {
      console.log(`ℹ️ Cars list sample highlights:`, res7.body.data.cars[0]?.highlights);
    }

    // ── Test 8: PUT /api/v1/cars/:id (Update highlights to 1 item) ──
    console.log('\n▶️ Test 8: PUT /api/v1/cars/:id (Update highlight_ids to 1 item)');
    const res8 = await request(app)
      .put(`/api/v1/cars/${createdCar.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ highlight_ids: [testHighlightIds[0]] });

    console.log(`Status: ${res8.status}`);
    if (res8.status !== 200 || !res8.body.data?.car?.highlights) {
      throw new Error(`Failed to update car highlights: ${JSON.stringify(res8.body)}`);
    }
    const updatedHighlights = res8.body.data.car.highlights;
    console.log(`✅ Updated car highlights:`, updatedHighlights);
    if (updatedHighlights.length !== 1 || updatedHighlights[0].id !== testHighlightIds[0]) {
      throw new Error(`Expected 1 highlight matching ${testHighlightIds[0]}, got ${JSON.stringify(updatedHighlights)}`);
    }

    // ── Test 9: PUT /api/v1/cars/:id with empty highlight_ids (Remove all) ──
    console.log('\n▶️ Test 9: PUT /api/v1/cars/:id with empty highlight_ids: [] (Remove all)');
    const res9 = await request(app)
      .put(`/api/v1/cars/${createdCar.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ highlight_ids: [] });

    console.log(`Status: ${res9.status}`);
    if (res9.status !== 200 || !res9.body.data?.car) {
      throw new Error(`Failed to remove highlights: ${JSON.stringify(res9.body)}`);
    }
    const clearedHighlights = res9.body.data.car.highlights;
    console.log(`✅ Cleared car highlights:`, clearedHighlights);
    if (!Array.isArray(clearedHighlights) || clearedHighlights.length !== 0) {
      throw new Error(`Expected 0 highlights, got ${clearedHighlights.length}`);
    }

    // ── Test 10: Rejection of Invalid Highlight ID on Update ──
    console.log('\n▶️ Test 10: PUT /api/v1/cars/:id with invalid highlight_ids (Expect 400)');
    const res10 = await request(app)
      .put(`/api/v1/cars/${createdCar.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ highlight_ids: ['00000000-0000-0000-0000-000000000000'] });

    console.log(`Status: ${res10.status} (Message: ${res10.body?.message})`);
    if (res10.status !== 400) {
      throw new Error(`Expected 400 on invalid highlight update, got ${res10.status}`);
    }
    console.log('✅ Correctly rejected invalid highlight ID on update');

    // Clean up test car
    await Car.destroy({ where: { id: createdCar.id } });
    console.log('\n🧹 Test car cleaned up.');

    console.log('\n======================================================');
    console.log('🎉 ALL 10 CAR HIGHLIGHTS TESTS PASSED SUCCESSFULLY! 🚀');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runTests();
