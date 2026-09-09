const request = require('supertest');
const app = require('../src/app');
const {
  createTempImageFile,
  createTempVideoFile,
  createTempAudioFile,
  cleanupTempFiles,
} = require('./helpers');

describe('Car Multimedia (Video & Audio) Integration Tests', () => {
  afterAll(() => {
    cleanupTempFiles();
  });

  const getRandomUser = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Media Tester ${randomId}`,
      phone: `9${randomId}002`,
      email: `car-media-${randomId}@test.com`,
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

  const postTestCar = async (token, overrides = {}) => {
    const primaryImg = createTempImageFile(`primary-${Date.now()}-${Math.random()}.png`);
    const reqObj = request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${token}`)
      .field('brand', overrides.brand || 'Toyota')
      .field('model', overrides.model || 'Innova')
      .field('variant', overrides.variant || 'ZX')
      .field('year', overrides.year || '2021')
      .field('price', overrides.price || '2600000')
      .field('price_negotiable', overrides.price_negotiable || 'true')
      .field('km_driven', overrides.km_driven || '35000')
      .field('fuel_type', overrides.fuel_type || 'diesel')
      .field('transmission', overrides.transmission || 'manual')
      .field('ownership', overrides.ownership || '1st owner')
      .field('body_type', overrides.body_type || 'SUV')
      .field('board_type', overrides.board_type || 'own board')
      .field('insurance_expiry_date', overrides.insurance_expiry_date || '2025-12-31')
      .field('insurance_type', overrides.insurance_type || 'comprehensive')
      .field('description', overrides.description || 'Well maintained family car')
      .field('color', overrides.color || 'White')
      .field('number_plate', overrides.number_plate || 'TN01AB1234')
      .field('prior_appointments', overrides.prior_appointments || 'false');

    if (overrides.video_url) {
      reqObj.field('video_url', overrides.video_url);
    }
    if (overrides.audio_url) {
      reqObj.field('audio_url', overrides.audio_url);
    }

    reqObj.attach('primary_image', primaryImg);

    if (overrides.withVideo) {
      const videoFile = createTempVideoFile(`video-${Date.now()}-${Math.random()}.mp4`);
      reqObj.attach('video', videoFile);
    }

    if (overrides.withAudio) {
      const audioFile = createTempAudioFile(`audio-${Date.now()}-${Math.random()}.mp3`);
      reqObj.attach('audio', audioFile);
    }

    const res = await reqObj;
    return res;
  };

  test('1. POST /api/v1/cars - create car with both video and audio', async () => {
    const { token } = await setupUser();

    const res = await postTestCar(token, { withVideo: true, withAudio: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.car.video_url).toBeTruthy();
    expect(res.body.data.car.audio_url).toBeTruthy();
    expect(res.body.data.car.video_url).toMatch(/video/);
    expect(res.body.data.car.audio_url).toMatch(/audio/);

    const carId = res.body.data.car.id;

    // Verify GET /api/v1/cars/:id returns video_url and audio_url
    const detailRes = await request(app).get(`/api/v1/cars/${carId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.car.video_url).toBe(res.body.data.car.video_url);
    expect(detailRes.body.data.car.audio_url).toBe(res.body.data.car.audio_url);

    // Verify GET /api/v1/cars list includes video_url and audio_url
    const listRes = await request(app).get('/api/v1/cars');
    expect(listRes.status).toBe(200);
    const listedCar = listRes.body.data.cars.find((c) => c.id === carId);
    expect(listedCar).toBeDefined();
    expect(listedCar.video_url).toBe(res.body.data.car.video_url);
    expect(listedCar.audio_url).toBe(res.body.data.car.audio_url);
  });

  test('2. POST /api/v1/cars - create car without video and audio leaves fields null', async () => {
    const { token } = await setupUser();

    const res = await postTestCar(token, { withVideo: false, withAudio: false });

    expect(res.status).toBe(200);
    expect(res.body.data.car.video_url).toBeNull();
    expect(res.body.data.car.audio_url).toBeNull();
  });

  test('3. PUT /api/v1/cars/:id - update car replacing video and removing audio', async () => {
    const { token } = await setupUser();

    // Create initially with video and audio
    const createRes = await postTestCar(token, { withVideo: true, withAudio: true });
    expect(createRes.status).toBe(200);

    const carId = createRes.body.data.car.id;
    const oldVideoUrl = createRes.body.data.car.video_url;
    expect(oldVideoUrl).toBeTruthy();
    expect(createRes.body.data.car.audio_url).toBeTruthy();

    // Update with new video and remove_audio: true
    const newVideo = createTempVideoFile(`replacement-video-${Date.now()}.mp4`);
    const updateRes = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', '1450000')
      .field('remove_audio', 'true')
      .attach('video', newVideo);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.car.video_url).toBeTruthy();
    expect(updateRes.body.data.car.video_url).not.toBe(oldVideoUrl);
    expect(updateRes.body.data.car.audio_url).toBeNull();

    // Verify detail endpoint
    const checkRes = await request(app).get(`/api/v1/cars/${carId}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.car.video_url).toBe(updateRes.body.data.car.video_url);
    expect(checkRes.body.data.car.audio_url).toBeNull();
  });

  test('4. PUT /api/v1/cars/:id - remove video via remove_video flag', async () => {
    const { token } = await setupUser();

    const createRes = await postTestCar(token, { withVideo: true, withAudio: false });
    expect(createRes.status).toBe(200);

    const carId = createRes.body.data.car.id;
    expect(createRes.body.data.car.video_url).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('remove_video', 'true');

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.car.video_url).toBeNull();
  });

  test('5. Security check: Client-provided video_url string is ignored if no file uploaded', async () => {
    const { token } = await setupUser();

    const res = await postTestCar(token, {
      withVideo: false,
      video_url: 'https://malicious-site.com/fake-video.mp4',
    });

    expect(res.status).toBe(200);
    // video_url must NOT be injected from client payload
    expect(res.body.data.car.video_url).toBeNull();
  });
});
