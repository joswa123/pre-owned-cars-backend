const request = require('supertest');
const app = require('../src/app');
const { Car } = require('../src/models');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('Car API Integration Tests', () => {
  afterAll(() => {
    cleanupTempFiles();
  });

  // Helper to generate unique test user payloads
  const getRandomUser = (role = 'customer') => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const user = {
      full_name: `Car Tester ${role} ${randomId}`,
      phone: `9${randomId}001`,
      email: `car-${role}-${randomId}@test.com`,
      password: 'Password@123',
      role,
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };

    if (role === 'dealer') {
      user.company_name = `Test Motors ${randomId}`;
      user.door_no = '10';
      user.building_name = 'Test Tower';
      user.street_name = 'Main Street';
      user.pincode = '641012';
    }

    return user;
  };

  // Helper to register, verify, and login user
  const setupUser = async (role = 'customer') => {
    const userData = getRandomUser(role);
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
      email: userData.email,
    };
  };

  // Helper to post a test car
  const postTestCar = async (token, overrides = {}) => {
    const primaryImg = createTempImageFile('primary.png');
    const reqObj = request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', overrides.brand || 'Toyota')
      .field('model', overrides.model || 'Innova')
      .field('variant', overrides.variant || 'ZX')
      .field('year', overrides.year || '2020')
      .field('price', overrides.price || '2500000')
      .field('price_negotiable', overrides.price_negotiable || 'true')
      .field('km_driven', overrides.km_driven || '45000')
      .field('fuel_type', overrides.fuel_type || 'diesel')
      .field('transmission', overrides.transmission || 'manual')
      .field('ownership', overrides.ownership || '1st owner')
      .field('body_type', overrides.body_type || 'SUV')
      .field('board_type', overrides.board_type || 'White')
      .field('insurance_expiry_date', overrides.insurance_expiry_date || '2025-12-31')
      .field('insurance_type', overrides.insurance_type || 'comprehensive')
      .field('description', overrides.description || 'Well maintained family car');

    if (overrides.b2b_listing !== undefined) {
      reqObj.field('b2b_listing', overrides.b2b_listing);
    }

    reqObj.attach('primary_image', primaryImg);

    if (overrides.withSecondary) {
      const secondaryImg = createTempImageFile('secondary.png');
      reqObj.attach('images', secondaryImg);
    }

    const res = await reqObj;
    return res;
  };

  // ---------- 1. Create Car as Customer ----------
  test('POST /api/v1/cars - customer can create a car (b2b_listing forced false)', async () => {
    const { token, userId } = await setupUser('customer');
    const res = await postTestCar(token, { b2b_listing: 'true', withSecondary: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.car).toHaveProperty('id');
    expect(res.body.data.car.posted_by_type).toBe('customer');
    expect(res.body.data.car.b2b_listing).toBe(false); // Forced false for customer
    expect(res.body.data.car.user_id).toBe(userId);
  });

  // ---------- 2. Create Car as Dealer (with b2b_listing = true) ----------
  test('POST /api/v1/cars - dealer can create a car with b2b_listing true', async () => {
    const { token, userId } = await setupUser('dealer');
    const res = await postTestCar(token, { b2b_listing: 'true' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.car.posted_by_type).toBe('dealer');
    expect(res.body.data.car.b2b_listing).toBe(true);
    expect(res.body.data.car.user_id).toBe(userId);
  });

  // ---------- 3. Get All Cars with Filters ----------
  test('GET /api/v1/cars - should return list of cars matching filters', async () => {
    const { token } = await setupUser('customer');
    await postTestCar(token, { brand: 'Toyota', body_type: 'SUV' });

    const res = await request(app)
      .get('/api/v1/cars')
      .query({ brand: 'Toyota', body_type: 'SUV' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.cars).toBeInstanceOf(Array);
    expect(res.body.data.cars.length).toBeGreaterThan(0);
    expect(res.body.data.cars[0].brand).toBe('Toyota');
  });

  // ---------- 4. Get Single Car Details ----------
  test('GET /api/v1/cars/:id - should return single car details', async () => {
    const { token, email } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;

    const res = await request(app).get(`/api/v1/cars/${carId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.car).toHaveProperty('id', carId);
    expect(res.body.data.car.seller).toHaveProperty('email', email);
    expect(res.body.data.car.images).toBeInstanceOf(Array);
  });

  // ---------- 5. Update Car (Owner Only) ----------
  test('PUT /api/v1/cars/:id - should update car details when requested by owner', async () => {
    const { token } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;

    const res = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: 2400000,
        description: 'Updated description by owner',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.car.description).toBe('Updated description by owner');

    const carInDb = await Car.findByPk(carId);
    expect(parseFloat(carInDb.price)).toBe(2400000);
  });

  // ---------- 6. Unauthorized Update Attempt ----------
  test('PUT /api/v1/cars/:id - should reject update when requested by non-owner', async () => {
    const { token: ownerToken } = await setupUser('customer');
    const { token: otherToken } = await setupUser('dealer');
    const carRes = await postTestCar(ownerToken);
    const carId = carRes.body.data.car.id;

    const res = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ price: 1000000 });

    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe('error');
  });

  // ---------- 7. Delete Car (Owner Only) ----------
  test('DELETE /api/v1/cars/:id - should delete car listing when requested by owner', async () => {
    const { token } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;

    const res = await request(app)
      .delete(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');

    const deletedCar = await Car.findByPk(carId);
    expect(deletedCar).toBeNull();
  });
});
