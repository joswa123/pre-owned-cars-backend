// tests/commercial-media.test.js
process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const {
  User,
  Brand,
  CarType,
  CommercialVehicle,
  CommercialVehicleImage,
} = require('../src/models');

describe('Commercial Vehicle Media, B2B & Prior Appointments Integration Tests', () => {
  let sellerUser;
  let sellerToken;
  let testBrand;
  let testVehicleType;
  const createdCommercialIds = [];
  const createdUserIds = [];

  const getUniquePhone = () => {
    return '9' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);
  };

  const createToken = (user) => {
    return jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'pre_owned_cars_jwt_secret',
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    sellerUser = await User.create({
      full_name: 'Media Test Seller',
      phone: getUniquePhone(),
      email: `mediaseller-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcommercialseller',
      role: 'dealer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(sellerUser.id);
    sellerToken = createToken(sellerUser);

    testBrand = await Brand.findOne({ where: { slug: 'tata' } }) || await Brand.findOne();
    testVehicleType = await CarType.findOne({ where: { slug: 'trucks' } }) || await CarType.findOne();
  });

  afterAll(async () => {
    for (const vid of createdCommercialIds) {
      await CommercialVehicleImage.destroy({ where: { commercial_vehicle_id: vid }, force: true });
      await CommercialVehicle.destroy({ where: { id: vid }, force: true });
    }
    for (const uid of createdUserIds) {
      await User.destroy({ where: { id: uid }, force: true });
    }
  });

  it('1. POST /api/v1/commercial - should accept video, audio, price_negotiable, b2b, and prior_appointments', async () => {
    const res = await request(app)
      .post('/api/v1/commercial')
      .set('Authorization', `Bearer ${sellerToken}`)
      .field('brand_id', testBrand.id)
      .field('vehicle_type_id', testVehicleType.id)
      .field('year', 2022)
      .field('price', 850000)
      .field('price_negotiable', 'true')
      .field('b2b', 'true')
      .field('prior_appointments', 'true')
      .field('km_driven', 45000)
      .field('fuel_type', 'Diesel')
      .field('ownership', '1st Owner')
      .field('description', 'Tata Truck with video, audio, b2b, and prior appointments.')
      .attach('primary_image', Buffer.from('fake image data'), 'primary.jpg')
      .attach('video', Buffer.from('fake video stream data'), 'sample_video.mp4')
      .attach('audio', Buffer.from('fake audio stream data'), 'sample_audio.mp3');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const vehicle = res.body.data.vehicle;
    createdCommercialIds.push(vehicle.id);

    expect(vehicle.price_negotiable).toBe(true);
    expect(vehicle.b2b_listing).toBe(true);
    expect(vehicle.b2b).toBe(true);
    expect(vehicle.prior_appointments).toBe(true);
    expect(vehicle.prior_appointemnts).toBe(true);
    expect(vehicle.video_url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(vehicle.audio_url).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    // Verify GET /:id returns the fields
    const getRes = await request(app)
      .get(`/api/v1/commercial/${vehicle.id}`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.vehicle.price_negotiable).toBe(true);
    expect(getRes.body.data.vehicle.b2b_listing).toBe(true);
    expect(getRes.body.data.vehicle.b2b).toBe(true);
    expect(getRes.body.data.vehicle.prior_appointments).toBe(true);
    expect(getRes.body.data.vehicle.prior_appointemnts).toBe(true);
    expect(getRes.body.data.vehicle.video_url).toBe(vehicle.video_url);
    expect(getRes.body.data.vehicle.audio_url).toBe(vehicle.audio_url);
  });

  it('2. PATCH /api/v1/commercial/:id - should support updating b2b, prior_appointments, remove_video and remove_audio', async () => {
    const vehicleId = createdCommercialIds[0];

    const patchRes = await request(app)
      .patch(`/api/v1/commercial/${vehicleId}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .field('remove_video', 'true')
      .field('remove_audio', 'true')
      .field('price_negotiable', 'false')
      .field('b2b', 'false')
      .field('prior_appointments', 'false');

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.vehicle.price_negotiable).toBe(false);
    expect(patchRes.body.data.vehicle.b2b_listing).toBe(false);
    expect(patchRes.body.data.vehicle.b2b).toBe(false);
    expect(patchRes.body.data.vehicle.prior_appointments).toBe(false);
    expect(patchRes.body.data.vehicle.prior_appointemnts).toBe(false);
    expect(patchRes.body.data.vehicle.video_url).toBeNull();
    expect(patchRes.body.data.vehicle.audio_url).toBeNull();
  });

  it('3. GET /api/v1/commercial - should filter by b2b_listing and prior_appointments', async () => {
    const vehicleId = createdCommercialIds[0];

    // Re-enable b2b and prior_appointments for filter test
    await request(app)
      .patch(`/api/v1/commercial/${vehicleId}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .field('b2b_listing', 'true')
      .field('prior_appointments', 'true');

    // Filter b2b_listing=true
    const filterB2bRes = await request(app)
      .get('/api/v1/commercial?b2b_listing=true');

    expect(filterB2bRes.status).toBe(200);
    const b2bIds = filterB2bRes.body.data.vehicles.map(v => v.id);
    expect(b2bIds).toContain(vehicleId);

    // Filter prior_appointments=true
    const filterPriorRes = await request(app)
      .get('/api/v1/commercial?prior_appointments=true');

    expect(filterPriorRes.status).toBe(200);
    const priorIds = filterPriorRes.body.data.vehicles.map(v => v.id);
    expect(priorIds).toContain(vehicleId);
  });

  it('4. POST /api/v1/commercial/:id/video - standalone upload works', async () => {
    const vehicleId = createdCommercialIds[0];

    const uploadRes = await request(app)
      .post(`/api/v1/commercial/${vehicleId}/video`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .attach('video', Buffer.from('fake standalone video'), 'walkthrough.mp4');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.status).toBe('success');
    expect(uploadRes.body.video_url).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    // Verify persisted
    const dbVehicle = await CommercialVehicle.findByPk(vehicleId);
    expect(dbVehicle.video_url).toBe(uploadRes.body.video_url);
  });

  it('5. POST /api/v1/commercial/:id/audio - standalone upload works', async () => {
    const vehicleId = createdCommercialIds[0];

    const uploadRes = await request(app)
      .post(`/api/v1/commercial/${vehicleId}/audio`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .attach('audio', Buffer.from('fake standalone audio'), 'engine_sound.mp3');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.status).toBe('success');
    expect(uploadRes.body.audio_url).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    // Verify persisted
    const dbVehicle = await CommercialVehicle.findByPk(vehicleId);
    expect(dbVehicle.audio_url).toBe(uploadRes.body.audio_url);
  });
});
