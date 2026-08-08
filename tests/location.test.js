const request = require('supertest');
const app = require('../src/app');
const { State, District, City, User, DealerProfile } = require('../src/models');
const sequelize = require('../src/config/database');
const crypto = require('crypto');

describe('Location API (Public)', () => {
  let stateId, districtId, cityId, dealerId;
  let nonDealerId;

  beforeAll(async () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    // Clear cache to avoid stale test data
    const redisClient = require('../src/config/redis');
    await redisClient.del('locations:hierarchy');
    await redisClient.del('__express__/api/v1/locations__');
    
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
      password_hash: 'password', 
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
    // Clean up specifically the test data we created, to avoid wiping out the whole DB!
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    if (dealerId) await DealerProfile.destroy({ where: { user_id: dealerId } });
    if (dealerId) await User.destroy({ where: { id: dealerId } });
    if (nonDealerId) await User.destroy({ where: { id: nonDealerId } });
    if (cityId) await City.destroy({ where: { id: cityId } });
    if (districtId) await District.destroy({ where: { id: districtId } });
    if (stateId) await State.destroy({ where: { id: stateId } });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  });

  test('GET /api/v1/locations - returns full hierarchy', async () => { 
    const res = await request(app).get('/api/v1/locations');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    // Find the test state in the returned array, in case DB has existing data
    const testState = res.body.data.find(s => s.id === stateId);
    expect(testState).toBeDefined();
    expect(testState.districts[0].cities[0].id).toBe(cityId);
  });

  test('GET /api/v1/locations/dealers?city_id=... - returns dealers in city', async () => {
    const res = await request(app).get(`/api/v1/locations/dealers?city_id=${cityId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const testDealer = res.body.data.find(d => d.id === dealerId);
    expect(testDealer).toBeDefined();
  });

  test('GET /api/v1/locations/dealers/:dealerId - returns dealer profile', async () => {
    const res = await request(app).get(`/api/v1/locations/dealers/${dealerId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(dealerId);
    expect(res.body.data.dealerProfile.company_name).toBe('Test Company');
  });

  test('GET /api/v1/locations/dealers/:dealerId - 404 for non-dealer', async () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    // Create a non-dealer user
    const nonDealer = await User.create({
      id: crypto.randomUUID(),
      full_name: `John Customer ${uniqueSuffix}`,
      email: `customer${uniqueSuffix}@test.com`,
      phone: `99${uniqueSuffix}11`,
      password_hash: 'password',
      role: 'customer',
      status: 'approved'
    });
    
    nonDealerId = nonDealer.id;
    const res = await request(app).get(`/api/v1/locations/dealers/${nonDealerId}`);
    expect(res.statusCode).toBe(404);
  });
});
