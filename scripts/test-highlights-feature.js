require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { User, Car, Highlight, Brand, Model, Variant } = require('../src/models');
const jwt = require('jsonwebtoken');

async function runTests() {
  console.log('🧪 Starting Car Highlights Feature Tests...\n');

  try {
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
    console.log(`✅ Fetched ${res1.body.data.length} active highlights (Sample: "${res1.body.data[0].name}")`);
    const availableHighlights = res1.body.data;
    const testHighlightIds = [availableHighlights[0].id, availableHighlights[1].id];

    // ── Test 2: Admin GET /api/v1/admin/highlights ──
    console.log('\n▶️ Test 2: Admin GET /api/v1/admin/highlights');
    const res2 = await request(app)
      .get('/api/v1/admin/highlights')
      .set('Authorization', `Bearer ${adminToken}`);
    console.log(`Status: ${res2.status}`);
    if (res2.status !== 200 || !Array.isArray(res2.body.data)) {
      throw new Error(`Admin highlights fetch failed: ${JSON.stringify(res2.body)}`);
    }
    console.log(`✅ Admin fetched ${res2.body.data.length} highlights`);

    // ── Test 3: Admin POST /api/v1/admin/highlights (Create) ──
    console.log('\n▶️ Test 3: Admin POST /api/v1/admin/highlights (Create new highlight)');
    const testHighlightName = `Test Tag ${Date.now()}`;
    const res3 = await request(app)
      .post('/api/v1/admin/highlights')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: testHighlightName, is_active: true });
    console.log(`Status: ${res3.status}`);
    if (res3.status !== 201 || !res3.body.data?.highlight?.id) {
      throw new Error(`Failed to create highlight: ${JSON.stringify(res3.body)}`);
    }
    const createdHighlightId = res3.body.data.highlight.id;
    console.log(`✅ Created highlight: "${res3.body.data.highlight.name}" (ID: ${createdHighlightId})`);

    // ── Test 4: Admin PUT /api/v1/admin/highlights/:id (Update) ──
    console.log('\n▶️ Test 4: Admin PUT /api/v1/admin/highlights/:id (Update highlight)');
    const updatedName = `${testHighlightName} Updated`;
    const res4 = await request(app)
      .put(`/api/v1/admin/highlights/${createdHighlightId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: updatedName, is_active: false });
    console.log(`Status: ${res4.status}`);
    if (res4.status !== 200 || res4.body.data?.highlight?.name !== updatedName) {
      throw new Error(`Failed to update highlight: ${JSON.stringify(res4.body)}`);
    }
    console.log(`✅ Updated highlight name to "${res4.body.data.highlight.name}" and is_active to false`);

    // ── Test 5: Admin DELETE /api/v1/admin/highlights/:id (Delete) ──
    console.log('\n▶️ Test 5: Admin DELETE /api/v1/admin/highlights/:id (Delete highlight)');
    const res5 = await request(app)
      .delete(`/api/v1/admin/highlights/${createdHighlightId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    console.log(`Status: ${res5.status}`);
    if (res5.status !== 200 && res5.status !== 204) {
      throw new Error(`Failed to delete highlight: ${JSON.stringify(res5.body)}`);
    }
    console.log('✅ Deleted test highlight successfully');

    // ── Test 6: Create Car with highlight_ids ──
    console.log('\n▶️ Test 6: POST /api/v1/cars with highlight_ids');
    let brand = await Brand.findOne();
    let model = await Model.findOne({ where: { brandId: brand.id } });
    let variant = model ? await Variant.findOne({ where: { model_id: model.id } }) : null;

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

    const res6 = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${userToken}`)
      .send(newCarPayload);

    console.log(`Status: ${res6.status}`);
    if (res6.status !== 200 || !res6.body.data?.car?.id) {
      throw new Error(`Failed to create car with highlights: ${JSON.stringify(res6.body)}`);
    }

    const createdCar = res6.body.data.car;
    console.log(`✅ Car created successfully with ID: ${createdCar.id}`);
    console.log(`   Highlights in create response: ${JSON.stringify(createdCar.highlights)}`);
    if (!Array.isArray(createdCar.highlights) || createdCar.highlights.length !== 2) {
      throw new Error('Highlights array not populated in create response');
    }

    // ── Test 7: GET /api/v1/cars/:id ──
    console.log('\n▶️ Test 7: GET /api/v1/cars/:id (Detail includes highlights)');
    const res7 = await request(app).get(`/api/v1/cars/${createdCar.id}`);
    console.log(`Status: ${res7.status}`);
    if (res7.status !== 200 || !res7.body.data?.car?.highlights) {
      throw new Error(`Failed to fetch car detail: ${JSON.stringify(res7.body)}`);
    }
    const fetchedHighlights = res7.body.data.car.highlights;
    console.log(`✅ Fetched car details with highlights:`, fetchedHighlights);
    if (fetchedHighlights.length !== 2) {
      throw new Error(`Expected 2 highlights, got ${fetchedHighlights.length}`);
    }

    // ── Test 8: GET /api/v1/cars (List includes highlights) ──
    console.log('\n▶️ Test 8: GET /api/v1/cars (List includes highlights)');
    const res8 = await request(app).get('/api/v1/cars?limit=10');
    console.log(`Status: ${res8.status}`);
    if (res8.status !== 200 || !Array.isArray(res8.body.data?.cars)) {
      throw new Error(`Failed to get cars list: ${JSON.stringify(res8.body)}`);
    }
    const carInList = res8.body.data.cars.find(c => c.id === createdCar.id);
    if (carInList) {
      console.log(`✅ Created car found in cars list with ${carInList.highlights?.length} highlights`);
    } else {
      console.log(`ℹ️ First car in list highlights:`, res8.body.data.cars[0]?.highlights);
    }

    // ── Test 9: PUT /api/v1/cars/:id (Update highlights) ──
    console.log('\n▶️ Test 9: PUT /api/v1/cars/:id (Update highlight_ids to 1 item)');
    const res9 = await request(app)
      .put(`/api/v1/cars/${createdCar.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ highlight_ids: [testHighlightIds[0]] });

    console.log(`Status: ${res9.status}`);
    if (res9.status !== 200 || !res9.body.data?.car?.highlights) {
      throw new Error(`Failed to update car highlights: ${JSON.stringify(res9.body)}`);
    }
    const updatedHighlights = res9.body.data.car.highlights;
    console.log(`✅ Updated car highlights:`, updatedHighlights);
    if (updatedHighlights.length !== 1 || updatedHighlights[0].id !== testHighlightIds[0]) {
      throw new Error(`Expected 1 highlight matching ${testHighlightIds[0]}, got ${JSON.stringify(updatedHighlights)}`);
    }

    // Clean up test car
    await Car.destroy({ where: { id: createdCar.id } });
    console.log('\n🧹 Test car cleaned up.');

    console.log('\n======================================================');
    console.log('🎉 ALL 9 CAR HIGHLIGHTS TESTS PASSED SUCCESSFULLY! 🚀');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runTests();
