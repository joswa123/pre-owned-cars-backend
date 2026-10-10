const request = require('supertest');
const app = require('../src/app');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('Car Update Fields Persistence Tests', () => {
  afterAll(() => {
    cleanupTempFiles();
  });

  const getRandomUser = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Update Fields Tester ${randomId}`,
      phone: `9${randomId}001`,
      email: `updatefields-${randomId}@test.com`,
      password: 'Password@123',
      role: 'dealer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
      company_name: `Auto Hub ${randomId}`,
      door_no: '12',
      building_name: 'Tower',
      street_name: 'Cross St',
      pincode: '641012',
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

  test('PUT /api/v1/cars/:id updates number_plate, color, prior_appointments, price_negotiable, and b2b_listing', async () => {
    const { token } = await setupUser();
    const primaryImg = createTempImageFile('car-test-initial.png');

    // Create a car initially with empty number_plate and false booleans
    const createRes = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', 'Maruti Suzuki')
      .field('model', 'Wagon R')
      .field('variant', 'LXi')
      .field('year', '2022')
      .field('price', '650000')
      .field('km_driven', '20000')
      .field('fuel_type', 'Petrol')
      .field('transmission', 'Manual')
      .field('ownership', '1st Owner')
      .field('body_type', 'Hatchback')
      .field('board_type', 'T-Board')
      .field('color', 'Red')
      .field('number_plate', '')
      .field('price_negotiable', 'false')
      .field('prior_appointments', 'false')
      .field('b2b_listing', 'false')
      .attach('primary_image', primaryImg);

    expect(createRes.status).toBe(200);
    const carId = createRes.body.data.car.id;

    // Update car with Flutter payload matching the user issue
    const updateRes = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('number_plate', 'TN01AB1234')
      .field('color', 'White')
      .field('prior_appointemnts', 'true')
      .field('price_negotiable', 'true')
      .field('b2b_listing', 'true');

    expect(updateRes.status).toBe(200);
    const updatedCar = updateRes.body.data.car;

    // Verify fields are NOT empty or false
    expect(updatedCar.number_plate).toBe('TN01AB1234');
    expect(updatedCar.color).toBe('White');
    expect(updatedCar.prior_appointments).toBe(true);
    expect(updatedCar.prior_appointemnts).toBe(true);
    expect(updatedCar.price_negotiable).toBe(true);
    expect(updatedCar.b2b_listing).toBe(true);
  });
});
