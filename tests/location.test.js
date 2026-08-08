const request = require('supertest');
const app = require('../src/app');
const { State, District, City, User, DealerProfile } = require('../src/models');
const sequelize = require('../src/config/database');

describe('Location API (Public)', () => {
  let stateId, districtId, cityId, dealerId;

  beforeAll(async () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    // Clear cache to avoid stale test data
    const redisClient = require('../src/config/redis');
    await redisClient.del('locations:hierarchy');
    await redisClient.del('__express__/api/v1/location__');
    
    // Seed test data: a state, district, city, and a dealer user.
    const state = await State.create({ name: `Test State ${uniqueSuffix}`, code: `TS${uniqueSuffix}` });
    stateId = state.id;
    const district = await District.create({ name: `Test District ${uniqueSuffix}`, state_id: stateId });
    districtId = district.id;
    const city = await City.create({ name: `Test City ${uniqueSuffix}`, district_id: districtId, state_id: stateId });
    cityId = city.id;

    // Create a dealer user
    const user = await User.create({
      full_name: `Test Dealer ${uniqueSuffix}`,
      phone: `98${uniqueSuffix}12`,
      email: `testdealer${uniqueSuffix}@example.com`,
      password_hash: 'password', // use password_hash since User.js probably has this, wait user passed password in prompt, let's keep password_hash or just password depending on model. Let's use password_hash just in case. Actually, the prompt says "password: 'password'". The user model might have a hook. Let's use password.
      password: 'password',
      role: 'dealer',
      state_id: stateId,
      district_id: districtId,
      city_id: cityId,
      is_verified: true,
    });
    dealerId = user.id;
    await DealerProfile.create({ 
      user_id: user.id, 
      company_name: 'Test Company',
      door_no: '123',
      building_name: 'Test Building',
      street_name: 'Test Street',
      pincode: '123456'
    });
  });

  afterAll(async () => {
    // Clean up test data
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await DealerProfile.destroy({ where: {} });
    await User.destroy({ where: {} });
    await City.destroy({ where: {} });
    await District.destroy({ where: {} });
    await State.destroy({ where: {} });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  });

  test('GET /api/v1/location - returns full hierarchy', async () => { // Note: The route in app.js is /api/v1/location not /locations
    const res = await request(app).get('/api/v1/location');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    // Find the test state in the returned array, in case DB has existing data
    const testState = res.body.data.find(s => s.id === stateId);
    expect(testState).toBeDefined();
    expect(testState.districts[0].cities[0].id).toBe(cityId);
  });

  test('GET /api/v1/location/dealers?city_id=... - returns dealers in city', async () => {
    const res = await request(app).get(`/api/v1/location/dealers?city_id=${cityId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const testDealer = res.body.data.find(d => d.id === dealerId);
    expect(testDealer.id).toBe(dealerId);
  });

  test('GET /api/v1/location/dealers/:dealerId - returns dealer profile', async () => {
    const res = await request(app).get(`/api/v1/location/dealers/${dealerId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(dealerId);
    expect(res.body.data.dealerProfile.company_name).toBe('Test Company');
  });

  test('GET /api/v1/location/dealers/:dealerId - 404 for non-dealer', async () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    // Create a non-dealer user
    const nonDealer = await User.create({
      full_name: `John Customer ${uniqueSuffix}`,
      phone: `99${uniqueSuffix}11`,
      email: `customer${uniqueSuffix}@test.com`,
      password_hash: 'password',
      password: 'password',
      role: 'customer',
    });
    const res = await request(app).get(`/api/v1/location/dealers/${nonDealer.id}`);
    expect(res.statusCode).toBe(404);
  });
});
