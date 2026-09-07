const request = require('supertest');
const app = require('../src/app');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('User and Dealer My Cars Isolation Tests', () => {
  afterAll(() => {
    cleanupTempFiles();
  });

  const getRandomUser = (role = 'customer') => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const user = {
      full_name: `Car Owner ${role} ${randomId}`,
      phone: `9${randomId}002`,
      email: `car-owner-${role}-${randomId}@test.com`,
      password: 'Password@123',
      role,
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };

    if (role === 'dealer') {
      user.company_name = `Test Dealer Corp ${randomId}`;
      user.door_no = '20';
      user.building_name = 'Dealer Complex';
      user.street_name = 'Commercial Road';
      user.pincode = '641012';
    }

    return user;
  };

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

  const postTestCar = async (token, overrides = {}) => {
    const primaryImg = createTempImageFile('primary.png');
    const reqObj = request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', overrides.brand || 'Toyota')
      .field('model', overrides.model || 'Fortuner')
      .field('variant', overrides.variant || 'Sigma')
      .field('year', overrides.year || 2021)
      .field('price', overrides.price || 3500000)
      .field('km_driven', overrides.km_driven || 30000)
      .field('fuel_type', overrides.fuel_type || 'diesel')
      .field('transmission', overrides.transmission || 'automatic')
      .field('ownership', overrides.ownership || '1st owner')
      .field('body_type', overrides.body_type || 'SUV')
      .field('board_type', overrides.board_type || 'OWN BOARD')
      .field('description', overrides.description || 'Exclusive car')
      .field('color', overrides.color || 'Black')
      .field('number_plate', overrides.number_plate || 'TN38AB9999');

    reqObj.attach('primary_image', primaryImg);
    return await reqObj;
  };

  test('GET /api/v1/cars/me - returns ONLY cars belonging to the authenticated user', async () => {
    const userA = await setupUser('customer');
    const userB = await setupUser('customer');

    // User A posts 2 cars
    const carA1 = await postTestCar(userA.token, { description: 'User A Car 1' });
    const carA2 = await postTestCar(userA.token, { description: 'User A Car 2' });
    const carA1Id = carA1.body.data.car.id;
    const carA2Id = carA2.body.data.car.id;

    // User B posts 1 car
    const carB1 = await postTestCar(userB.token, { description: 'User B Car 1' });
    const carB1Id = carB1.body.data.car.id;

    // Fetch user A's cars
    const resA = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(resA.statusCode).toBe(200);
    expect(resA.body.status).toBe('success');
    expect(resA.body.data.cars).toBeInstanceOf(Array);

    const userACarIds = resA.body.data.cars.map((c) => c.id);
    expect(userACarIds).toContain(carA1Id);
    expect(userACarIds).toContain(carA2Id);
    expect(userACarIds).not.toContain(carB1Id);

    // Every car returned must strictly have user_id === userA.userId
    resA.body.data.cars.forEach((car) => {
      expect(car.user_id).toBe(userA.userId);
    });

    // Fetch user B's cars
    const resB = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${userB.token}`);

    expect(resB.statusCode).toBe(200);
    expect(resB.body.status).toBe('success');
    const userBCarIds = resB.body.data.cars.map((c) => c.id);
    expect(userBCarIds).toContain(carB1Id);
    expect(userBCarIds).not.toContain(carA1Id);
    expect(userBCarIds).not.toContain(carA2Id);

    resB.body.data.cars.forEach((car) => {
      expect(car.user_id).toBe(userB.userId);
    });
  });

  test('GET /api/v1/cars?user_id=me / ?posted_by_me=true - filters only current user cars', async () => {
    const userA = await setupUser('customer');
    const carA = await postTestCar(userA.token, { description: 'User A Filter Car' });
    const carAId = carA.body.data.car.id;

    const resMe = await request(app)
      .get('/api/v1/cars?user_id=me')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(resMe.statusCode).toBe(200);
    expect(resMe.body.data.cars).toBeInstanceOf(Array);
    resMe.body.data.cars.forEach((car) => {
      expect(car.user_id).toBe(userA.userId);
    });

    const resPostedByMe = await request(app)
      .get('/api/v1/cars?posted_by_me=true')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(resPostedByMe.statusCode).toBe(200);
    expect(resPostedByMe.body.data.cars).toBeInstanceOf(Array);
    resPostedByMe.body.data.cars.forEach((car) => {
      expect(car.user_id).toBe(userA.userId);
    });
  });

  test('GET /api/v1/users/me/listings and /api/v1/users/me/cars - returns logged-in user cars', async () => {
    const user = await setupUser('customer');
    const car = await postTestCar(user.token, { description: 'User Listings Car' });
    const carId = car.body.data.car.id;

    const resListings = await request(app)
      .get('/api/v1/users/me/listings')
      .set('Authorization', `Bearer ${user.token}`);

    expect(resListings.statusCode).toBe(200);
    expect(resListings.body.data.cars).toBeInstanceOf(Array);
    resListings.body.data.cars.forEach((c) => {
      expect(c.user_id).toBe(user.userId);
    });

    const resCars = await request(app)
      .get('/api/v1/users/me/cars')
      .set('Authorization', `Bearer ${user.token}`);

    expect(resCars.statusCode).toBe(200);
    expect(resCars.body.data.cars).toBeInstanceOf(Array);
    resCars.body.data.cars.forEach((c) => {
      expect(c.user_id).toBe(user.userId);
    });
  });

  test('GET /api/v1/cars/me?status=sold returns only authenticated user sold cars; public endpoint returns all sold cars', async () => {
    const customerA = await setupUser('customer');
    const dealerB = await setupUser('dealer');

    // Customer A posts a car and marks it as sold
    const carA = await postTestCar(customerA.token, { description: 'Customer A Sold Car' });
    const carAId = carA.body.data.car.id;
    const sellResA = await request(app)
      .patch(`/api/v1/cars/${carAId}/sell`)
      .set('Authorization', `Bearer ${customerA.token}`);
    expect(sellResA.statusCode).toBe(200);
    expect(sellResA.body.data.car.status).toBe('sold');

    // Dealer B posts a car and marks it as sold
    const carB = await postTestCar(dealerB.token, { description: 'Dealer B Sold Car' });
    const carBId = carB.body.data.car.id;
    const sellResB = await request(app)
      .patch(`/api/v1/cars/${carBId}/sell`)
      .set('Authorization', `Bearer ${dealerB.token}`);
    expect(sellResB.statusCode).toBe(200);
    expect(sellResB.body.data.car.status).toBe('sold');

    // 1. Customer A calls GET /api/v1/cars/me?status=sold -> only Customer A's sold car returned
    const resCustomerA = await request(app)
      .get('/api/v1/cars/me?status=sold')
      .set('Authorization', `Bearer ${customerA.token}`);
    expect(resCustomerA.statusCode).toBe(200);
    const customerASoldIds = resCustomerA.body.data.cars.map(c => c.id);
    expect(customerASoldIds).toContain(carAId);
    expect(customerASoldIds).not.toContain(carBId);
    resCustomerA.body.data.cars.forEach(car => {
      expect(car.user_id).toBe(customerA.userId);
      expect(car.status).toBe('sold');
    });

    // 2. Dealer B calls GET /api/v1/cars/me?status=sold -> only Dealer B's sold car returned
    const resDealerB = await request(app)
      .get('/api/v1/cars/me?status=sold')
      .set('Authorization', `Bearer ${dealerB.token}`);
    expect(resDealerB.statusCode).toBe(200);
    const dealerBSoldIds = resDealerB.body.data.cars.map(c => c.id);
    expect(dealerBSoldIds).toContain(carBId);
    expect(dealerBSoldIds).not.toContain(carAId);
    resDealerB.body.data.cars.forEach(car => {
      expect(car.user_id).toBe(dealerB.userId);
      expect(car.status).toBe('sold');
    });

    // 3. Public GET /api/v1/cars?status=sold -> returns all sold cars (both users' cars)
    const resPublicSold = await request(app)
      .get('/api/v1/cars?status=sold');
    expect(resPublicSold.statusCode).toBe(200);
    const publicSoldIds = resPublicSold.body.data.cars.map(c => c.id);
    expect(publicSoldIds).toContain(carAId);
    expect(publicSoldIds).toContain(carBId);

    // 4. Security Check: Non-admin calling public endpoint with user_id or seller_id is ignored
    const resIgnoredUserId = await request(app)
      .get(`/api/v1/cars?status=sold&user_id=${dealerB.userId}`)
      .set('Authorization', `Bearer ${customerA.token}`);
    expect(resIgnoredUserId.statusCode).toBe(200);
    const ignoredUserCarIds = resIgnoredUserId.body.data.cars.map(c => c.id);
    // Because user_id was ignored for non-admin, it still returns the global sold list containing customerA's car
    expect(ignoredUserCarIds).toContain(carAId);
  });
});
