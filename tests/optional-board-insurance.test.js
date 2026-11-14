const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  User,
  DealerProfile,
  Car,
  CarImage,
  Brand,
  Model,
  Variant,
  CarType,
  CommercialVehicle,
  CommercialVehicleImage,
  State,
  District,
  City,
} = require('../src/models');

const makePhone = (prefix) => {
  const rand = `${Math.floor(1000000 + Math.random() * 8999999)}`;
  const ts = `${Date.now()}`.slice(-2);
  return `${prefix}${ts}${rand}`;
};

describe('Optional Board Type, Insurance Type, Insurance Expiry Date Tests', () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let testUser;
  let userToken;
  let testBrand;
  let testModel;
  let testVariant;
  let testVehicleType;
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

    testUser = await User.create({
      full_name: `Test User ${suffix}`,
      phone: makePhone('8'),
      email: `testuser_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      status: 'approved',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    userToken = jwt.sign(
      { id: testUser.id, role: testUser.role, email: testUser.email },
      process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-min!!',
      { expiresIn: '1h' }
    );

    testBrand = await Brand.create({
      name: `OptBrand_${suffix}`,
      slug: `opt-brand-${suffix}`,
      is_active: true,
    });

    testModel = await Model.create({
      brandId: testBrand.id,
      name: `OptModel_${suffix}`,
      slug: `opt-model-${suffix}`,
      is_active: true,
    });

    testVariant = await Variant.create({
      model_id: testModel.id,
      name: `OptVariant_${suffix}`,
      slug: `opt-variant-${suffix}`,
      is_active: true,
    });

    testVehicleType = await CarType.create({
      name: `OptType_${suffix}`,
      slug: `opt-type-${suffix}`,
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
      if (testVehicleType) await CarType.destroy({ where: { id: testVehicleType.id } });
      if (testBrand) await Brand.destroy({ where: { id: testBrand.id } });
      if (testUser) await User.destroy({ where: { id: testUser.id } });
    } catch (e) {
      // ignore cleanup errors
    }
  });

  describe('1. Car: Optional board_type, insurance_type, insurance_expiry_date', () => {
    it('creates car without board_type, insurance_type, insurance_expiry_date (all omitted) and uses defaults', async () => {
      const res = await request(app)
        .post('/api/v1/cars')
        .set('Authorization', `Bearer ${userToken}`)
        .field('brand_id', testBrand.id)
        .field('model_id', testModel.id)
        .field('variant_id', testVariant.id)
        .field('year', 2021)
        .field('price', 550000)
        .field('km_driven', 35000)
        .field('fuel_type', 'petrol')
        .field('transmission', 'manual')
        .field('ownership', '1st owner')
        .field('body_type', 'Sedan')
        .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/car1.jpg');

      expect([200, 201]).toContain(res.status);
      const car = res.body.data.car;
      createdCarIds.push(car.id);

      expect(car.board_type).toBe('Own Board');
      expect(car.boardType).toBe('Own Board');
      expect(car.insurance_type).toBe('Not Insured');
      expect(car.insuranceType).toBe('Not Insured');
      expect(car.insurance_expiry_date).toBeNull();
      expect(car.insuranceExpiryDate).toBeNull();
    });

    it('creates car with explicit values for board_type, insurance_type, insurance_expiry_date', async () => {
      const res = await request(app)
        .post('/api/v1/cars')
        .set('Authorization', `Bearer ${userToken}`)
        .field('brand_id', testBrand.id)
        .field('model_id', testModel.id)
        .field('variant_id', testVariant.id)
        .field('year', 2022)
        .field('price', 650000)
        .field('km_driven', 20000)
        .field('fuel_type', 'diesel')
        .field('transmission', 'manual')
        .field('ownership', '1st owner')
        .field('body_type', 'SUV')
        .field('board_type', 't-board')
        .field('insurance_type', 'comprehensive')
        .field('insurance_expiry_date', '2027-12-31')
        .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/car2.jpg');

      expect([200, 201]).toContain(res.status);
      const car = res.body.data.car;
      createdCarIds.push(car.id);

      expect(car.board_type).toBe('T-Board');
      expect(car.insurance_type).toBe('Comprehensive');
      expect(car.insurance_expiry_date).toBe('2027-12-31');
    });

    it('creates car with aliases: boardType, insuranceType, insuranceExpiryDate, yellow, zero dep', async () => {
      const res = await request(app)
        .post('/api/v1/cars')
        .set('Authorization', `Bearer ${userToken}`)
        .field('brand_id', testBrand.id)
        .field('model_id', testModel.id)
        .field('variant_id', testVariant.id)
        .field('year', 2023)
        .field('price', 750000)
        .field('km_driven', 10000)
        .field('fuel_type', 'petrol')
        .field('transmission', 'automatic')
        .field('ownership', '1st owner')
        .field('body_type', 'Hatchback')
        .field('boardType', 'yellow')
        .field('insuranceType', 'zero dep')
        .field('insuranceExpiryDate', '2028-06-15')
        .field('primary_image', 'https://res.cloudinary.com/test-cloud/image/upload/v12345/car3.jpg');

      expect([200, 201]).toContain(res.status);
      const car = res.body.data.car;
      createdCarIds.push(car.id);

      expect(car.board_type).toBe('Commercial');
      expect(car.insurance_type).toBe('Comprehensive');
      expect(car.insurance_expiry_date).toBe('2028-06-15');
    });
  });

  describe('2. Commercial Vehicle: Optional board_type, insurance_type, insurance_expiry_date', () => {
    it('creates commercial vehicle without board_type, insurance_type, insurance_expiry_date (all omitted) and uses defaults', async () => {
      const res = await request(app)
        .post('/api/v1/commercial')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          brand_id: testBrand.id,
          vehicle_type_id: testVehicleType.id,
          year: 2021,
          price: 420000,
          km_driven: 45000,
          fuel_type: 'diesel',
          ownership: '1st owner',
          description: 'Tata Ace test default board insurance',
          primary_image: 'https://res.cloudinary.com/test-cloud/image/upload/v12345/comm1.jpg',
        });

      expect(res.status).toBe(201);
      const vehicle = res.body.data.vehicle || res.body.data;
      createdCommercialIds.push(vehicle.id);

      expect(vehicle.board_type).toBe('Commercial');
      expect(vehicle.boardType).toBe('Commercial');
      expect(vehicle.insurance_type).toBe('Not Insured');
      expect(vehicle.insuranceType).toBe('Not Insured');
      expect(vehicle.insurance_expiry_date).toBeNull();
      expect(vehicle.insuranceExpiryDate).toBeNull();
    });

    it('creates commercial vehicle with explicit board_type, insurance_type, insurance_expiry_date', async () => {
      const res = await request(app)
        .post('/api/v1/commercial')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          brand_id: testBrand.id,
          vehicle_type_id: testVehicleType.id,
          year: 2022,
          price: 520000,
          km_driven: 25000,
          fuel_type: 'diesel',
          ownership: '1st owner',
          board_type: 'own board',
          insurance_type: 'third party',
          insurance_expiry_date: '2026-11-20',
          primary_image: 'https://res.cloudinary.com/test-cloud/image/upload/v12345/comm2.jpg',
        });

      expect(res.status).toBe(201);
      const vehicle = res.body.data.vehicle || res.body.data;
      createdCommercialIds.push(vehicle.id);

      expect(vehicle.board_type).toBe('Own Board');
      expect(vehicle.insurance_type).toBe('Third Party');
      expect(vehicle.insurance_expiry_date).toBe('2026-11-20');
    });

    it('creates commercial vehicle with aliases: boardType, insuranceType, insurance_valid_till', async () => {
      const res = await request(app)
        .post('/api/v1/commercial')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          brand_id: testBrand.id,
          vehicle_type_id: testVehicleType.id,
          year: 2023,
          price: 600000,
          km_driven: 15000,
          fuel_type: 'diesel',
          ownership: '1st owner',
          boardType: 't-board',
          insuranceType: 'comprehensive',
          insurance_valid_till: '2027-04-10',
          primary_image: 'https://res.cloudinary.com/test-cloud/image/upload/v12345/comm3.jpg',
        });

      expect(res.status).toBe(201);
      const vehicle = res.body.data.vehicle || res.body.data;
      createdCommercialIds.push(vehicle.id);

      expect(vehicle.board_type).toBe('T-Board');
      expect(vehicle.insurance_type).toBe('Comprehensive');
      expect(vehicle.insurance_expiry_date).toBe('2027-04-10');
    });

    it('updates commercial vehicle board_type, insurance_type, insurance_expiry_date via PATCH', async () => {
      const commId = createdCommercialIds[0];

      const patchRes = await request(app)
        .patch(`/api/v1/commercial/${commId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          board_type: 't-board',
          insurance_type: 'comprehensive',
          insurance_expiry_date: '2029-05-01',
        });

      expect(patchRes.status).toBe(200);
      const updated = patchRes.body.data.vehicle || patchRes.body.data;
      expect(updated.board_type).toBe('T-Board');
      expect(updated.insurance_type).toBe('Comprehensive');
      expect(updated.insurance_expiry_date).toBe('2029-05-01');

      // Now clear insurance_expiry_date with null
      const clearRes = await request(app)
        .patch(`/api/v1/commercial/${commId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          insurance_expiry_date: null,
          insurance_type: 'not insured',
        });

      expect(clearRes.status).toBe(200);
      const cleared = clearRes.body.data.vehicle || clearRes.body.data;
      expect(cleared.insurance_expiry_date).toBeNull();
      expect(cleared.insurance_type).toBe('Not Insured');
    });

    it('filters commercial vehicles by board_type and insurance_type on GET /api/v1/commercial', async () => {
      const resBoard = await request(app)
        .get('/api/v1/commercial')
        .query({ board_type: 'Own Board', brand_id: testBrand.id });

      expect(resBoard.status).toBe(200);
      const items = resBoard.body.data.vehicles || resBoard.body.data.rows || [];
      expect(items.length).toBeGreaterThanOrEqual(1);
      items.forEach((item) => {
        expect(item.board_type).toBe('Own Board');
      });

      const resIns = await request(app)
        .get('/api/v1/commercial')
        .query({ insurance_type: 'Third Party', brand_id: testBrand.id });

      expect(resIns.status).toBe(200);
      const insItems = resIns.body.data.vehicles || resIns.body.data.rows || [];
      expect(insItems.length).toBeGreaterThanOrEqual(1);
      insItems.forEach((item) => {
        expect(item.insurance_type).toBe('Third Party');
      });
    });
  });
});
