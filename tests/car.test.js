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
    if (!regRes.body || !regRes.body.data) {
      throw new Error(`Registration failed in setupUser (${regRes.status}): ${JSON.stringify(regRes.body)}`);
    }
    const otp = regRes.body.data.otp;
    await request(app).post('/api/v1/auth/verify').send({ email: userData.email, code: otp });
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: userData.email,
      password: userData.password,
    });
    if (!loginRes.body || !loginRes.body.data) {
      throw new Error(`Login failed in setupUser (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
    }
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
      .field('board_type', overrides.board_type || 'OWN BOARD')
      .field('insurance_expiry_date', overrides.insurance_expiry_date || '2025-12-31')
      .field('insurance_type', overrides.insurance_type || 'comprehensive')
      .field('description', overrides.description || 'Well maintained family car')
      .field('color', overrides.color || 'White')
      .field('number_plate', overrides.number_plate || 'TN01AB1234')
      .field('prior_appointments', overrides.prior_appointments || 'false');

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
    expect(res.body.data.car.price_negotiable).toBe(true);
    expect(res.body.data.car.insurance_type).toBe('Comprehensive');
    expect(res.body.data.car.description).toBe('Well maintained family car');
    expect(res.body.data.car.color).toBe('White');
    expect(res.body.data.car.number_plate).toBe('TN01AB1234');
    expect(res.body.data.car.prior_appointments).toBe(false);
    expect(res.body.data.car.user_id).toBe(userId);
    expect(res.body.data.car).toHaveProperty('state_id');
    expect(res.body.data.car).toHaveProperty('district_id');
    expect(res.body.data.car).toHaveProperty('city_id');
    expect(res.body.data.car.state_id).not.toBeNull();
  });

  // ---------- 2. Create Car as Dealer (with b2b_listing = true) ----------
  test('POST /api/v1/cars - dealer can create a car with b2b_listing true', async () => {
    const { token, userId } = await setupUser('dealer');
    const res = await postTestCar(token, { b2b_listing: 'true' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.car.posted_by_type).toBe('dealer');
    expect(res.body.data.car.b2b_listing).toBe(true);
    expect(res.body.data.car.price_negotiable).toBe(true);
    expect(res.body.data.car.insurance_type).toBe('Comprehensive');
    expect(res.body.data.car.description).toBe('Well maintained family car');
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
    expect(res.body.data.cars[0].brand.name).toBe('Toyota');
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
    expect(res.body.data.car.posted_by_type).toBe('customer');
    expect(res.body.data.car.b2b_listing).toBe(false);
    expect(res.body.data.car.price_negotiable).toBe(true);
    expect(res.body.data.car.insurance_type).toBe('Comprehensive');
    expect(res.body.data.car.description).toBe('Well maintained family car');
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
  test('DELETE /api/v1/cars/:id - should soft delete car listing when requested by owner', async () => {
    const { token } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;

    const res = await request(app)
      .delete(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');

    // Due to defaultScope, findByPk should return null
    const deletedCarScoped = await Car.findByPk(carId);
    expect(deletedCarScoped).toBeNull();

    // Verify it still exists in DB as 'deleted'
    const deletedCarUnscoped = await Car.unscoped().findByPk(carId);
    expect(deletedCarUnscoped).not.toBeNull();
    expect(deletedCarUnscoped.status).toBe('deleted');
    expect(deletedCarUnscoped.deleted_at).not.toBeNull();

    // Verify GET /api/v1/cars/:id returns 404
    const getRes = await request(app)
      .get(`/api/v1/cars/${carId}`);
    expect(getRes.statusCode).toBe(404);
  });
  // ---------- 8. Get User Cars (My Cars) with Filters ----------
  test('GET /api/v1/cars/me - should return my cars matching status filter', async () => {
    const { token } = await setupUser('customer');
    
    // Post an active car
    const activeCarRes = await postTestCar(token, { brand: 'Honda' });
    const activeCarId = activeCarRes.body.data.car.id;
    
    // Post a car and update it to sold
    const soldCarRes = await postTestCar(token, { brand: 'Hyundai' });
    const soldCarId = soldCarRes.body.data.car.id;
    await Car.update({ status: 'sold' }, { where: { id: soldCarId } });

    // Filter active
    const resActive = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'active' });

    expect(resActive.statusCode).toBe(200);
    expect(resActive.body.data.cars).toBeInstanceOf(Array);
    expect(resActive.body.data.cars.length).toBe(1);
    expect(resActive.body.data.cars[0].id).toBe(activeCarId);

    // Filter sold
    const resSold = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'sold' });

    expect(resSold.statusCode).toBe(200);
    expect(resSold.body.data.cars).toBeInstanceOf(Array);
    expect(resSold.body.data.cars.length).toBe(1);
    expect(resSold.body.data.cars[0].id).toBe(soldCarId);

    // Filter deleted
    await request(app).delete(`/api/v1/cars/${activeCarId}`).set('Authorization', `Bearer ${token}`);
    const resDeleted = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${token}`)
      .query({ status: 'deleted' });

    expect(resDeleted.statusCode).toBe(200);
    expect(resDeleted.body.data.cars).toBeInstanceOf(Array);
    expect(resDeleted.body.data.cars.length).toBe(1);
    expect(resDeleted.body.data.cars[0].id).toBe(activeCarId);
  });

  // ---------- 9. Get Cars with Location Filter ----------
  test('GET /api/v1/cars - should return list of cars matching city_id filter', async () => {
    const { token, userId } = await setupUser('customer');
    const userInDb = await require('../src/models/User').findByPk(userId);
    const userCityId = userInDb.city_id;
    
    await postTestCar(token, { brand: 'Toyota' });

    const res = await request(app)
      .get('/api/v1/cars')
      .query({ city_id: userCityId });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.cars).toBeInstanceOf(Array);
    expect(res.body.data.cars.length).toBeGreaterThan(0);
    expect(res.body.data.cars[0].city_id).toBe(userCityId);
    expect(res.body.data.cars[0].city).toHaveProperty('name', 'Gandhipuram');
  });
  // ---------- 10. Delete Car Image ----------
  test('DELETE /api/v1/cars/:id/images/:imageId - should delete a specific image', async () => {
    const { token } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;
    const images = carRes.body.data.car.images;
    
    expect(images.length).toBeGreaterThan(0);
    const imageId = images[0].id;

    const res = await request(app)
      .delete(`/api/v1/cars/${carId}/images/${imageId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');

    const CarImage = require('../src/models/CarImage');
    const deletedImage = await CarImage.findByPk(imageId);
    expect(deletedImage).toBeNull();
  });

  // ---------- 11. Unauthorized Car Image Deletion ----------
  test('DELETE /api/v1/cars/:id/images/:imageId - should reject unauthorized delete', async () => {
    const { token: ownerToken } = await setupUser('customer');
    const { token: otherToken } = await setupUser('dealer');
    const carRes = await postTestCar(ownerToken);
    const carId = carRes.body.data.car.id;
    const imageId = carRes.body.data.car.images[0].id;

    const res = await request(app)
      .delete(`/api/v1/cars/${carId}/images/${imageId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.statusCode).toBe(404);
  });

  // ---------- 12. Update Car with images_to_keep ----------
  test('PUT /api/v1/cars/:id - should remove images not in images_to_keep', async () => {
    const { token } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;
    const images = carRes.body.data.car.images;

    // We will keep only the first image and drop the rest
    const imagesToKeep = [images[0].id];

    const res = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', 2500000) // need to send a field to update
      .field('images_to_keep', JSON.stringify(imagesToKeep)); // Send as JSON string for multipart

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');

    const CarImage = require('../src/models/CarImage');
    const remainingImages = await CarImage.findAll({ where: { car_id: carId } });
    expect(remainingImages.length).toBe(1);
    expect(remainingImages[0].id).toBe(images[0].id);
  });
  // ---------- 13. Update Car with replace_images ----------
  test('PUT /api/v1/cars/:id - should remove all old images when replace_images is true', async () => {
    const { token } = await setupUser('customer');
    const carRes = await postTestCar(token);
    const carId = carRes.body.data.car.id;
    const images = carRes.body.data.car.images;
    
    expect(images.length).toBeGreaterThan(0);

    const res = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('price', 2500000)
      .field('replace_images', 'true'); // Simulate multipart form data

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');

    const CarImage = require('../src/models/CarImage');
    const remainingImages = await CarImage.findAll({ where: { car_id: carId } });
    
    // Because we didn't send new files in this test request, all images should be gone
    expect(remainingImages.length).toBe(0);
  });
});
