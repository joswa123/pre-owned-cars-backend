const request = require('supertest');
const app = require('../src/app');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('Price Drop Tracking Feature Tests', () => {
  afterAll(() => {
    cleanupTempFiles();
  });

  const getRandomUser = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Price Drop Tester ${randomId}`,
      phone: `9${randomId}001`,
      email: `pricedrop-${randomId}@test.com`,
      password: 'Password@123',
      role: 'customer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };
  };

  const setupUser = async () => {
    const userData = getRandomUser();
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

  const createTestCar = async (token, price = '1000000') => {
    const primaryImg = createTempImageFile('pricedrop-primary.png');
    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', 'Hyundai')
      .field('model', 'Creta')
      .field('variant', 'SX')
      .field('year', '2021')
      .field('price', price)
      .field('km_driven', '30000')
      .field('fuel_type', 'petrol')
      .field('transmission', 'manual')
      .field('ownership', '1st owner')
      .field('body_type', 'SUV')
      .field('board_type', 'OWN BOARD')
      .attach('primary_image', primaryImg);

    return res.body.data.car;
  };

  test('1. Qualified price drop sets previous_price and has_price_drop=true', async () => {
    const { token } = await setupUser();
    const car = await createTestCar(token, '1000000');

    // Drop price to ₹9,00,000 (Drop: 1,00,000 >= MAX(5000, 10000))
    const updateRes = await request(app)
      .put(`/api/v1/cars/${car.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '900000');

    expect(updateRes.status).toBe(200);
    const updatedCar = updateRes.body.data.car;
    expect(Number(updatedCar.price)).toBe(900000);
    expect(Number(updatedCar.previous_price)).toBe(1000000);
    expect(updatedCar.has_price_drop).toBe(true);
  });

  test('2. String comparison bug test (dropping to 95,000 does not fail)', async () => {
    const { token } = await setupUser();
    const car = await createTestCar(token, '1000000');

    // Drop price to ₹95,000 ("95000" < "1000000" in string comparison would be false)
    const updateRes = await request(app)
      .put(`/api/v1/cars/${car.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '95000');

    expect(updateRes.status).toBe(200);
    const updatedCar = updateRes.body.data.car;
    expect(Number(updatedCar.price)).toBe(95000);
    expect(Number(updatedCar.previous_price)).toBe(1000000);
    expect(updatedCar.has_price_drop).toBe(true);
  });

  test('3. Negligible price drop (< threshold) updates price without triggering price drop flag', async () => {
    const { token } = await setupUser();
    const car = await createTestCar(token, '1000000');

    // Drop price by only ₹2,000 (1% of 10L is 10,000, min threshold is 10,000)
    const updateRes = await request(app)
      .put(`/api/v1/cars/${car.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '998000');

    expect(updateRes.status).toBe(200);
    const updatedCar = updateRes.body.data.car;
    expect(Number(updatedCar.price)).toBe(998000);
    expect(updatedCar.previous_price).toBeNull();
    expect(updatedCar.has_price_drop).toBe(false);
  });

  test('4. Price hike resets previous_price to null and has_price_drop to false', async () => {
    const { token } = await setupUser();
    const car = await createTestCar(token, '1000000');

    // First: drop price
    await request(app)
      .put(`/api/v1/cars/${car.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '900000');

    // Second: hike price back up to ₹11,00,000
    const hikeRes = await request(app)
      .put(`/api/v1/cars/${car.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '1100000');

    expect(hikeRes.status).toBe(200);
    const hikedCar = hikeRes.body.data.car;
    expect(Number(hikedCar.price)).toBe(1100000);
    expect(hikedCar.previous_price).toBeNull();
    expect(hikedCar.has_price_drop).toBe(false);
  });

  test('5. Direct client manipulation of previous_price or has_price_drop is stripped and ignored', async () => {
    const { token } = await setupUser();
    const car = await createTestCar(token, '1000000');

    // Malicious attempt to inject fake previous_price
    const hackRes = await request(app)
      .put(`/api/v1/cars/${car.id}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '1000000')
      .field('previous_price', '5000000')
      .field('has_price_drop', 'true');

    expect(hackRes.status).toBe(200);
    const hackedCar = hackRes.body.data.car;
    expect(hackedCar.previous_price).toBeNull();
    expect(hackedCar.has_price_drop).toBe(false);
  });
});
