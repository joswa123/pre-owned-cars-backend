// tests/commercial-similar-seller.test.js
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

describe('Commercial Vehicle Similar, Recommended & Seller APIs Integration Tests', () => {
  let seller1, seller2;
  let seller1Token, seller2Token;
  let testBrand1, testBrand2;
  let testType1, testType2;
  let vehicle1, vehicle2, vehicle3, vehicle4;

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
    // 1. Create 2 Sellers
    seller1 = await User.create({
      full_name: 'Primary Dealer',
      phone: getUniquePhone(),
      email: `dealer1-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcommercialseller',
      role: 'dealer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(seller1.id);
    seller1Token = createToken(seller1);

    seller2 = await User.create({
      full_name: 'Second Dealer',
      phone: getUniquePhone(),
      email: `dealer2-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcommercialseller',
      role: 'dealer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(seller2.id);
    seller2Token = createToken(seller2);

    // 2. Reference brands and types
    const brands = await Brand.findAll({ limit: 2 });
    testBrand1 = brands[0];
    testBrand2 = brands[1] || brands[0];

    const types = await CarType.findAll({ limit: 2 });
    testType1 = types[0];
    testType2 = types[1] || types[0];

    // 3. Create test vehicles
    // Vehicle 1: Seller 1, Brand 1, Type 1, 800k
    vehicle1 = await CommercialVehicle.create({
      user_id: seller1.id,
      brand_id: testBrand1.id,
      vehicle_type_id: testType1.id,
      year: 2022,
      price: 800000,
      price_negotiable: true,
      km_driven: 40000,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      description: 'Vehicle 1 - Ashok Leyland Truck',
      posted_by_type: 'dealer',
      status: 'active',
      slug: `vehicle-1-${Date.now()}`,
      views_count: 50,
    });
    createdCommercialIds.push(vehicle1.id);
    await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle1.id,
      image_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1/primary.jpg',
      is_primary: true,
    });

    // Vehicle 2: Seller 1, Brand 1, Type 1, 850k (High similarity with Vehicle 1)
    vehicle2 = await CommercialVehicle.create({
      user_id: seller1.id,
      brand_id: testBrand1.id,
      vehicle_type_id: testType1.id,
      year: 2023,
      price: 850000,
      price_negotiable: false,
      km_driven: 30000,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      description: 'Vehicle 2 - Similar to Vehicle 1',
      posted_by_type: 'dealer',
      status: 'active',
      slug: `vehicle-2-${Date.now()}`,
      views_count: 100,
    });
    createdCommercialIds.push(vehicle2.id);
    await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle2.id,
      image_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1/primary2.jpg',
      is_primary: true,
    });

    // Vehicle 3: Seller 2, Brand 1, Type 2, 900k
    vehicle3 = await CommercialVehicle.create({
      user_id: seller2.id,
      brand_id: testBrand1.id,
      vehicle_type_id: testType2.id,
      year: 2021,
      price: 900000,
      price_negotiable: true,
      km_driven: 60000,
      fuel_type: 'Diesel',
      ownership: '2nd Owner',
      description: 'Vehicle 3 - Same brand different type',
      posted_by_type: 'dealer',
      status: 'active',
      slug: `vehicle-3-${Date.now()}`,
      views_count: 80,
    });
    createdCommercialIds.push(vehicle3.id);
    await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle3.id,
      image_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1/primary3.jpg',
      is_primary: true,
    });

    // Vehicle 4: Seller 1, Brand 2, Type 2, 500k
    vehicle4 = await CommercialVehicle.create({
      user_id: seller1.id,
      brand_id: testBrand2.id,
      vehicle_type_id: testType2.id,
      year: 2020,
      price: 500000,
      price_negotiable: false,
      km_driven: 75000,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      description: 'Vehicle 4 - Seller 1 secondary vehicle',
      posted_by_type: 'dealer',
      status: 'active',
      slug: `vehicle-4-${Date.now()}`,
      views_count: 20,
    });
    createdCommercialIds.push(vehicle4.id);
    await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle4.id,
      image_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1/primary4.jpg',
      is_primary: true,
    });
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

  it('1. GET /api/v1/commercial/similar-recommended - should return similar & recommended vehicles', async () => {
    const res = await request(app)
      .get(`/api/v1/commercial/similar-recommended?vehicleId=${vehicle1.id}&limit=4`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();

    // Verify similar vehicles
    const similar = res.body.data.similarVehicles || res.body.data.similar;
    expect(similar).toBeDefined();
    expect(similar.data).toBeInstanceOf(Array);
    expect(similar.data.length).toBeGreaterThan(0);

    // Vehicle 2 should be the top similar candidate
    const similarIds = similar.data.map(v => v.id);
    expect(similarIds).toContain(vehicle2.id);
    expect(similarIds).not.toContain(vehicle1.id); // target vehicle excluded

    // Verify recommended vehicles
    const recommended = res.body.data.recommendedVehicles || res.body.data.recommended;
    expect(recommended).toBeInstanceOf(Array);
    const recommendedIds = recommended.map(v => v.id);
    expect(recommendedIds).not.toContain(vehicle1.id); // target vehicle excluded
  });

  it('2. GET /api/v1/commercial/:id/similar - should return similar vehicles for specific ID', async () => {
    const res = await request(app)
      .get(`/api/v1/commercial/${vehicle1.id}/similar?limit=2`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.data).toBeInstanceOf(Array);
    const ids = res.body.data.data.map(v => v.id);
    expect(ids).toContain(vehicle2.id);
    expect(ids).not.toContain(vehicle1.id);
  });

  it('3. GET /api/v1/commercial/:id/recommended - should return recommended commercial vehicles', async () => {
    const res = await request(app)
      .get(`/api/v1/commercial/${vehicle1.id}/recommended?limit=2`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeInstanceOf(Array);
    const ids = res.body.data.map(v => v.id);
    expect(ids).not.toContain(vehicle1.id);
  });

  it('4. GET /api/v1/commercial/seller/:sellerId - should return seller public listings', async () => {
    const res = await request(app)
      .get(`/api/v1/commercial/seller/${seller1.id}?limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.listings).toBeInstanceOf(Array);

    const ids = res.body.data.listings.map(v => v.id);
    // Seller 1 owns vehicle 1, 2, and 4
    expect(ids).toContain(vehicle1.id);
    expect(ids).toContain(vehicle2.id);
    expect(ids).toContain(vehicle4.id);
    // Seller 1 does NOT own vehicle 3
    expect(ids).not.toContain(vehicle3.id);

    // Test excludeVehicleId
    const resExclude = await request(app)
      .get(`/api/v1/commercial/seller/${seller1.id}?excludeVehicleId=${vehicle1.id}`);
    const idsExclude = resExclude.body.data.listings.map(v => v.id);
    expect(idsExclude).not.toContain(vehicle1.id);
  });

  it('5. GET /api/v1/users/:userId/listings?type=commercial - should route to commercial seller listings', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${seller1.id}/listings?type=commercial`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.listings).toBeInstanceOf(Array);

    const ids = res.body.data.listings.map(v => v.id);
    expect(ids).toContain(vehicle1.id);
    expect(ids).not.toContain(vehicle3.id);
  });
});

