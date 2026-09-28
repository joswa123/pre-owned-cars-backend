const request = require('supertest');
const app = require('../src/app');
const { CarImage } = require('../src/models');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('Cloudinary Image Storage & URL Validation Tests', () => {
  afterAll(async () => {
    cleanupTempFiles();
    try {
      const { sequelize } = require('../src/models');
      await sequelize.close();
    } catch (e) {}
  });

  const getRandomUser = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Cloudinary Tester ${randomId}`,
      phone: `9${randomId}003`,
      email: `cloud-${randomId}@test.com`,
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

  test('1. Upload car with images -> assert API response and DB values match /^https:\\/\\/res\\.cloudinary\\.com\\//', async () => {
    const { token } = await setupUser();

    const primaryImg = createTempImageFile(`cloud-primary-${Date.now()}.png`);
    const secondaryImg = createTempImageFile(`cloud-sec-${Date.now()}.png`);

    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', 'Toyota')
      .field('model', 'Innova')
      .field('variant', 'ZX')
      .field('year', '2022')
      .field('price', '2800000')
      .field('km_driven', '25000')
      .field('fuel_type', 'diesel')
      .field('transmission', 'manual')
      .field('ownership', '1st owner')
      .field('body_type', 'SUV')
      .field('board_type', 'own board')
      .attach('primary_image', primaryImg)
      .attach('images', secondaryImg);

    if (res.status !== 200) {
      console.log('POST /api/v1/cars failed with:', res.status, res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const carData = res.body.data.car;
    const carId = carData.id;

    // ─── API Response Assertions ─────────────────────────────
    // 1. primary_image must be a valid Cloudinary secure_url
    expect(carData.primary_image).toBeTruthy();
    expect(carData.primary_image).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(carData.primary_image).not.toMatch(/^[a-zA-Z]:[/\\]/);
    expect(carData.primary_image).not.toMatch(/\/uploads\//);
    expect(carData.primary_image).not.toMatch(/onrender\.com.*\.png/);

    // 2. images array of objects { image_url, is_primary, public_id }
    expect(Array.isArray(carData.images)).toBe(true);
    expect(carData.images.length).toBeGreaterThanOrEqual(1);

    for (const img of carData.images) {
      expect(img).toHaveProperty('image_url');
      expect(img).toHaveProperty('is_primary');
      expect(img).toHaveProperty('public_id');
      expect(img.image_url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      expect(img.public_id).toBeTruthy();
      expect(img.public_id).toMatch(/autodeal4u\/cars\//);
    }

    // ─── Database Direct Assertions ──────────────────────────
    const dbImages = await CarImage.findAll({ where: { car_id: carId } });
    expect(dbImages.length).toBeGreaterThanOrEqual(1);

    for (const record of dbImages) {
      expect(record.image_url).toBeTruthy();
      expect(record.image_url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      expect(record.image_url).not.toMatch(/^[a-zA-Z]:[/\\]/);
      expect(record.image_url).not.toMatch(/\/uploads\//);
      expect(record.public_id).toBeTruthy();
      expect(record.public_id).toMatch(/autodeal4u\/cars\//);
    }
  });

  test('2. Model Pre-Save Hook: Rejects any image URL not starting with https://res.cloudinary.com/', async () => {
    // Attempting to create a CarImage with a local disk path must throw an error
    await expect(
      CarImage.create({
        car_id: '11111111-1111-1111-1111-111111111111',
        image_url: 'D:\\pre-owned-cars-backend\\uploads\\cars\\test.png',
        is_primary: true,
      })
    ).rejects.toThrow(/https:\/\/res\.cloudinary\.com\//);

    // Attempting to create a CarImage with a relative /uploads/ path must throw an error
    await expect(
      CarImage.create({
        car_id: '11111111-1111-1111-1111-111111111111',
        image_url: '/uploads/cars/test.png',
        is_primary: false,
      })
    ).rejects.toThrow(/https:\/\/res\.cloudinary\.com\//);

    // Attempting to bulkCreate CarImages with a non-Cloudinary URL must throw an error
    await expect(
      CarImage.bulkCreate([
        {
          car_id: '11111111-1111-1111-1111-111111111111',
          image_url: 'https://pre-owned-cars-backend.onrender.com/uploads/cars/fake.png',
          is_primary: true,
        },
      ])
    ).rejects.toThrow(/https:\/\/res\.cloudinary\.com\//);
  });
});
