const request = require('supertest');
const app = require('../src/app');
const { Car } = require('../src/models');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('Fuel Type and Transmission Unconstrained String Validation Tests', () => {
  afterAll(async () => {
    cleanupTempFiles();
    try {
      const sequelize = require('../src/config/database');
      await sequelize.close();
    } catch (e) {}
  });

  const getRandomUser = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Flex Tester ${randomId}`,
      phone: `9${randomId}004`,
      email: `flex-${randomId}@test.com`,
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

  test('1. POST /api/v1/cars accepts arbitrary unpredicted strings for fuel_type and transmission', async () => {
    const { token } = await setupUser();
    const primaryImg = createTempImageFile(`flex-primary-${Date.now()}.png`);

    const arbitraryFuel = 'Hydrogen Fuel Cell';
    const arbitraryTrans = 'Direct Drive Multi-Speed';

    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', 'Hyundai')
      .field('model', 'Nexo')
      .field('year', '2023')
      .field('price', '3500000')
      .field('km_driven', '5000')
      .field('fuel_type', arbitraryFuel)
      .field('transmission', arbitraryTrans)
      .field('ownership', '1st owner')
      .field('body_type', 'SUV')
      .field('board_type', 'own board')
      .attach('primary_image', primaryImg);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const carData = res.body.data.car;
    expect(carData.fuel_type).toBe(arbitraryFuel);
    expect(carData.transmission).toBe(arbitraryTrans);

    // Verify DB record
    const dbCar = await Car.findByPk(carData.id);
    expect(dbCar.fuel_type).toBe(arbitraryFuel);
    expect(dbCar.transmission).toBe(arbitraryTrans);

    // 2. PUT /api/v1/cars/:id updates with another arbitrary string
    const updatedFuel = 'Bio-Gas Hybrid Extended';
    const updatedTrans = 'e-CVT Shifttronic';

    const updateRes = await request(app)
      .put(`/api/v1/cars/${carData.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fuel_type: updatedFuel,
        transmission: updatedTrans,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('success');
    expect(updateRes.body.data.car.fuel_type).toBe(updatedFuel);
    expect(updateRes.body.data.car.transmission).toBe(updatedTrans);

    const reloaded = await Car.findByPk(carData.id);
    expect(reloaded.fuel_type).toBe(updatedFuel);
    expect(reloaded.transmission).toBe(updatedTrans);
  });

  test('2. POST /api/v1/cars succeeds when fuel_type and transmission are omitted or null', async () => {
    const { token } = await setupUser();
    const primaryImg = createTempImageFile(`flex-primary-def-${Date.now()}.png`);

    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', 'Maruti')
      .field('model', 'Swift')
      .field('year', '2021')
      .field('price', '650000')
      .field('km_driven', '20000')
      .field('ownership', '1st owner')
      .field('body_type', 'Hatchback')
      .field('board_type', 'own board')
      .attach('primary_image', primaryImg);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const carData = res.body.data.car;
    // Defaults applied gracefully
    expect(carData.fuel_type).toBe('Petrol');
    expect(carData.transmission).toBe('Manual');
  });
});
