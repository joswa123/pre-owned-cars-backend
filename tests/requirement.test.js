const request = require('supertest');
const app = require('../src/app');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');
const { Brand, Model } = require('../src/models');

describe('Buying Requirements Range Fields Tests', () => {
  let userToken;
  let userId;
  let testBrand;
  let testModel;

  afterAll(() => {
    cleanupTempFiles();
  });

  const setupUser = async () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const userData = {
      full_name: `Requirement User ${randomId}`,
      phone: `9${randomId}003`,
      email: `req-user-${randomId}@test.com`,
      password: 'Password@123',
      role: 'customer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };

    const regRes = await request(app).post('/api/v1/auth/register').send(userData);
    const otp = regRes.body.data.otp;
    await request(app).post('/api/v1/auth/verify').send({ email: userData.email, code: otp });
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: userData.email,
      password: userData.password,
    });
    return {
      token: loginRes.body.data.accessToken,
      userId: loginRes.body.data.user.id,
    };
  };

  beforeAll(async () => {
    const user = await setupUser();
    userToken = user.token;
    userId = user.userId;

    // Ensure a test brand and model exist
    [testBrand] = await Brand.findOrCreate({
      where: { name: 'Hyundai' },
      defaults: { name: 'Hyundai', is_active: true },
    });

    [testModel] = await Model.findOrCreate({
      where: { name: 'Creta', brandId: testBrand.id },
      defaults: { name: 'Creta', brandId: testBrand.id, body_type: 'SUV', is_active: true },
    });
  });

  test('POST /api/v1/requirements - creates requirement with min/max price & km ranges', async () => {
    const payload = {
      brand_id: testBrand.id,
      model_id: testModel.id,
      year: 2022,
      min_price: 500000,
      max_price: 1000000,
      min_km: 10000,
      max_km: 50000,
      body_type: 'SUV',
      transmission: 'Automatic',
      board_type: 'Own Board',
      color: 'White',
      purchase_plan_days: 30,
      description: 'Looking for a clean Creta within budget range',
    };

    const res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${userToken}`)
      .send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();

    const reqData = res.body.data;
    expect(parseFloat(reqData.min_price)).toBe(500000);
    expect(parseFloat(reqData.max_price)).toBe(1000000);
    expect(reqData.min_km).toBe(10000);
    expect(reqData.max_km).toBe(50000);
  });

  test('POST /api/v1/requirements - validation fails when min_price > max_price', async () => {
    const invalidPayload = {
      brand_id: testBrand.id,
      model_id: testModel.id,
      min_price: 1000000,
      max_price: 500000,
      body_type: 'SUV',
      transmission: 'Automatic',
      board_type: 'Own Board',
      purchase_plan_days: 15,
    };

    const res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${userToken}`)
      .send(invalidPayload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/min_price cannot be greater than max_price/i);
  });

  test('POST /api/v1/requirements - validation fails when min_km > max_km', async () => {
    const invalidPayload = {
      brand_id: testBrand.id,
      model_id: testModel.id,
      min_km: 80000,
      max_km: 20000,
      body_type: 'SUV',
      transmission: 'Automatic',
      board_type: 'Own Board',
      purchase_plan_days: 15,
    };

    const res = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${userToken}`)
      .send(invalidPayload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/min_km cannot be greater than max_km/i);
  });

  test('GET /api/v1/requirements/me - returns user requirements with range fields', async () => {
    const res = await request(app)
      .get('/api/v1/requirements/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.requirements).toBeInstanceOf(Array);
    expect(res.body.data.requirements.length).toBeGreaterThan(0);

    const first = res.body.data.requirements[0];
    expect(first).toHaveProperty('min_price');
    expect(first).toHaveProperty('max_price');
    expect(first).toHaveProperty('min_km');
    expect(first).toHaveProperty('max_km');
  });

  test('PUT /api/v1/requirements/:id - updates range fields successfully', async () => {
    // Create initial requirement
    const createRes = await request(app)
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        brand_id: testBrand.id,
        model_id: testModel.id,
        min_price: 400000,
        max_price: 800000,
        min_km: 5000,
        max_km: 30000,
        body_type: 'SUV',
        transmission: 'Manual',
        board_type: 'Own Board',
        purchase_plan_days: 20,
      });

    expect(createRes.statusCode).toBe(201);
    const requirementId = createRes.body.data.id;

    // Update with new ranges
    const updateRes = await request(app)
      .put(`/api/v1/requirements/${requirementId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        min_price: 600000,
        max_price: 1200000,
        min_km: 15000,
        max_km: 45000,
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.status).toBe('success');

    const updated = updateRes.body.data;
    expect(parseFloat(updated.min_price)).toBe(600000);
    expect(parseFloat(updated.max_price)).toBe(1200000);
    expect(updated.min_km).toBe(15000);
    expect(updated.max_km).toBe(45000);
  });
});
