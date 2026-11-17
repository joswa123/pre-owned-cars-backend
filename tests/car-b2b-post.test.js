const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  User,
  DealerProfile,
  Car,
  CarImage,
  CommercialVehicle,
  CommercialVehicleImage,
  Brand,
  Model,
  Variant,
  CarType,
  State,
  District,
  City,
} = require('../src/models');

const makePhone = (prefix) => {
  const rand = `${Math.floor(1000000 + Math.random() * 8999999)}`;
  const ts = `${Date.now()}`.slice(-2);
  return `${prefix}${ts}${rand}`;
};

describe('B2B Posting and GET Endpoints Reflection Tests (Customer & Dealer)', () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let dealerUser;
  let dealerToken;
  let customerUser;
  let customerToken;
  let testBrand;
  let testModel;
  let testVariant;
  let testCarType;
  let testState;
  let testDistrict;
  let testCity;

  const createdCarIds = [];
  const createdCommercialIds = [];

  beforeAll(async () => {
    testState = await State.findOne({ where: { name: 'Tamil Nadu' } });
    testDistrict = await District.findOne({ where: { state_id: testState.id } });
    testCity = await City.findOne({ where: { district_id: testDistrict.id } });

    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    // Dealer user
    dealerUser = await User.create({
      full_name: `B2B Dealer ${suffix}`,
      phone: makePhone('9'),
      email: `b2bdealer_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'dealer',
      status: 'approved',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    await DealerProfile.create({
      user_id: dealerUser.id,
      company_name: `B2B Motors ${suffix}`,
      dealership_license: `LIC_${suffix}`,
      door_no: '123',
      building_name: 'B2B Towers',
      street_name: 'Main Road',
      pincode: '641001',
    });

    dealerToken = jwt.sign(
      { id: dealerUser.id, role: dealerUser.role, email: dealerUser.email },
      process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-min!!',
      { expiresIn: '1h' }
    );

    // Customer user
    customerUser = await User.create({
      full_name: `B2B Customer ${suffix}`,
      phone: makePhone('8'),
      email: `b2bcustomer_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      status: 'approved',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    customerToken = jwt.sign(
      { id: customerUser.id, role: customerUser.role, email: customerUser.email },
      process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-min!!',
      { expiresIn: '1h' }
    );

    testBrand = await Brand.create({
      name: `B2BBrand_${suffix}`,
      slug: `b2b-brand-${suffix}`,
      is_active: true,
    });

    testModel = await Model.create({
      brandId: testBrand.id,
      name: `B2BModel_${suffix}`,
      slug: `b2b-model-${suffix}`,
      is_active: true,
    });

    testVariant = await Variant.create({
      model_id: testModel.id,
      name: `B2BVariant_${suffix}`,
      slug: `b2b-variant-${suffix}`,
      is_active: true,
    });

    testCarType = await CarType.create({
      name: `B2BType_${suffix}`,
      slug: `b2b-type-${suffix}`,
      is_active: true,
    });
  });

  afterAll(async () => {
    try {
      if (createdCarIds.length) {
        await CarImage.destroy({ where: { car_id: createdCarIds } });
        await Car.destroy({ where: { id: createdCarIds }, force: true });
      }
      if (createdCommercialIds.length) {
        await CommercialVehicleImage.destroy({ where: { commercial_vehicle_id: createdCommercialIds } });
        await CommercialVehicle.destroy({ where: { id: createdCommercialIds }, force: true });
      }
      if (testVariant) await Variant.destroy({ where: { id: testVariant.id } });
      if (testModel) await Model.destroy({ where: { id: testModel.id } });
      if (testCarType) await CarType.destroy({ where: { id: testCarType.id } });
      if (testBrand) await Brand.destroy({ where: { id: testBrand.id } });
      if (dealerUser) {
        await DealerProfile.destroy({ where: { user_id: dealerUser.id } });
        await User.destroy({ where: { id: dealerUser.id } });
      }
      if (customerUser) {
        await User.destroy({ where: { id: customerUser.id } });
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it('1. Dealer posts car with payload { b2b: true } -> persisted and returned as b2b: true', async () => {
    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${dealerToken}`)
      .field('brand_id', testBrand.id)
      .field('model_id', testModel.id)
      .field('variant_id', testVariant.id)
      .field('year', 2022)
      .field('price', 650000)
      .field('km_driven', 28000)
      .field('fuel_type', 'petrol')
      .field('transmission', 'manual')
      .field('ownership', '1st owner')
      .field('body_type', 'SUV')
      .field('b2b', 'true')
      .field('prior_appointments', 'true')
      .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/b2b-car1.jpg');

    expect([200, 201]).toContain(res.status);
    const car = res.body.data.car;
    createdCarIds.push(car.id);

    expect(car.b2b).toBe(true);
    expect(car.b2b_listing).toBe(true);
    expect(car.b2bListing).toBe(true);
    expect(car.prior_appointments).toBe(true);
    expect(car.prior_appointemnts).toBe(true);

    // Verify GET /api/v1/cars/:id reflects b2b: true and b2b_listing: true
    const getRes = await request(app).get(`/api/v1/cars/${car.id}`);
    expect(getRes.status).toBe(200);
    const fetchedCar = getRes.body.data.car || getRes.body.data;
    expect(fetchedCar.b2b).toBe(true);
    expect(fetchedCar.b2b_listing).toBe(true);
    expect(fetchedCar.prior_appointments).toBe(true);
  });

  it('2. Dealer posts car with { b2b_listing: true } -> returns b2b: true and b2b_listing: true', async () => {
    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${dealerToken}`)
      .field('brand_id', testBrand.id)
      .field('model_id', testModel.id)
      .field('variant_id', testVariant.id)
      .field('year', 2023)
      .field('price', 820000)
      .field('km_driven', 15000)
      .field('fuel_type', 'diesel')
      .field('transmission', 'automatic')
      .field('ownership', '1st owner')
      .field('body_type', 'SUV')
      .field('b2b_listing', 'true')
      .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/b2b-car2.jpg');

    expect([200, 201]).toContain(res.status);
    const car = res.body.data.car;
    createdCarIds.push(car.id);

    expect(car.b2b).toBe(true);
    expect(car.b2b_listing).toBe(true);

    const getRes = await request(app).get(`/api/v1/cars/${car.id}`);
    expect(getRes.status).toBe(200);
    const fetchedCar = getRes.body.data.car || getRes.body.data;
    expect(fetchedCar.b2b).toBe(true);
    expect(fetchedCar.b2b_listing).toBe(true);
  });

  it('3. GET /api/v1/cars?b2b=true and ?b2b_listing=true filter b2b cars properly', async () => {
    const res1 = await request(app).get('/api/v1/cars?b2b=true');
    expect(res1.status).toBe(200);
    const cars1 = res1.body.data.cars || res1.body.data;
    const foundCar1 = cars1.find((c) => createdCarIds.includes(c.id));
    expect(foundCar1).toBeDefined();
    expect(foundCar1.b2b).toBe(true);
    expect(foundCar1.b2b_listing).toBe(true);

    const res2 = await request(app).get('/api/v1/cars?b2b_listing=true');
    expect(res2.status).toBe(200);
    const cars2 = res2.body.data.cars || res2.body.data;
    const foundCar2 = cars2.find((c) => createdCarIds.includes(c.id));
    expect(foundCar2).toBeDefined();
    expect(foundCar2.b2b).toBe(true);
    expect(foundCar2.b2b_listing).toBe(true);
  });

  it('4. Updating a car with { b2b: false } updates b2b to false', async () => {
    const carId = createdCarIds[0];
    const updateRes = await request(app)
      .put(`/api/v1/cars/${carId}`)
      .set('Authorization', `Bearer ${dealerToken}`)
      .field('b2b', 'false');

    expect(updateRes.status).toBe(200);
    const updatedCar = updateRes.body.data.car || updateRes.body.data;
    expect(updatedCar.b2b).toBe(false);
    expect(updatedCar.b2b_listing).toBe(false);

    const getRes = await request(app).get(`/api/v1/cars/${carId}`);
    expect(getRes.status).toBe(200);
    const fetched = getRes.body.data.car || getRes.body.data;
    expect(fetched.b2b).toBe(false);
    expect(fetched.b2b_listing).toBe(false);
  });

  it('5. Customer (role: customer) posts car with payload { b2b: true } -> persisted and returned as b2b: true', async () => {
    const res = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${customerToken}`)
      .field('brand_id', testBrand.id)
      .field('model_id', testModel.id)
      .field('variant_id', testVariant.id)
      .field('year', 2022)
      .field('price', 550000)
      .field('km_driven', 35000)
      .field('fuel_type', 'petrol')
      .field('transmission', 'manual')
      .field('ownership', '1st owner')
      .field('body_type', 'Sedan')
      .field('b2b', 'true')
      .field('posted_by_type', 'customer')
      .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/cust-car1.jpg');

    expect([200, 201]).toContain(res.status);
    const car = res.body.data.car;
    createdCarIds.push(car.id);

    expect(car.posted_by_type).toBe('customer');
    expect(car.b2b).toBe(true);
    expect(car.b2b_listing).toBe(true);
    expect(car.b2bListing).toBe(true);

    // Verify GET /api/v1/cars/:id
    const getRes = await request(app).get(`/api/v1/cars/${car.id}`);
    expect(getRes.status).toBe(200);
    const fetchedCar = getRes.body.data.car || getRes.body.data;
    expect(fetchedCar.b2b).toBe(true);
    expect(fetchedCar.b2b_listing).toBe(true);
  });

  it('6. Customer (role: customer) creates commercial vehicle with { b2b_listing: true } -> returns b2b: true', async () => {
    const res = await request(app)
      .post('/api/v1/commercial')
      .set('Authorization', `Bearer ${customerToken}`)
      .field('brand_id', testBrand.id)
      .field('vehicle_type_id', testCarType.id)
      .field('year', 2024)
      .field('price', 750000)
      .field('km_driven', 20000)
      .field('fuel_type', 'Diesel')
      .field('ownership', '1st Owner')
      .field('b2b_listing', 'true')
      .field('prior_appointments', 'true')
      .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/comm1.jpg');

    expect([200, 201]).toContain(res.status);
    const vehicle = res.body.data.vehicle;
    createdCommercialIds.push(vehicle.id);

    expect(vehicle.posted_by_type).toBe('customer');
    expect(vehicle.b2b).toBe(true);
    expect(vehicle.b2b_listing).toBe(true);
    expect(vehicle.b2bListing).toBe(true);
    expect(vehicle.prior_appointments).toBe(true);

    // Verify GET /api/v1/commercial/:id
    const getRes = await request(app).get(`/api/v1/commercial/${vehicle.id}`);
    expect(getRes.status).toBe(200);
    const fetched = getRes.body.data.vehicle || getRes.body.data;
    expect(fetched.b2b).toBe(true);
    expect(fetched.b2b_listing).toBe(true);
    expect(fetched.b2bListing).toBe(true);
  });

  it('7. Customer (role: customer) updates commercial vehicle with PUT and { b2b_listing: true } -> returns b2b: true', async () => {
    const commId = createdCommercialIds[0];
    const updateRes = await request(app)
      .put(`/api/v1/commercial/${commId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        brand_id: testBrand.id,
        vehicle_type_id: testCarType.id,
        year: 2024,
        price: 590000,
        km_driven: 23000,
        fuel_type: 'Petrol',
        ownership: '1st Owner',
        b2b_listing: true,
        price_negotiable: true,
        prior_appointemnts: true,
        posted_by_type: 'customer',
      });

    expect(updateRes.status).toBe(200);
    const updated = updateRes.body.data.vehicle || updateRes.body.data;
    expect(updated.b2b).toBe(true);
    expect(updated.b2b_listing).toBe(true);
    expect(updated.b2bListing).toBe(true);
    expect(updated.posted_by_type).toBe('customer');

    // Verify GET endpoint reflects b2b: true
    const getRes = await request(app).get(`/api/v1/commercial/${commId}`);
    expect(getRes.status).toBe(200);
    const fetched = getRes.body.data.vehicle || getRes.body.data;
    expect(fetched.b2b).toBe(true);
    expect(fetched.b2b_listing).toBe(true);
  });
});
