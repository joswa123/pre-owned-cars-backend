// tests/commercial-phase3.test.js
process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Car,
  VehicleType,
  Brand,
  Model,
  Variant,
  State,
  District,
  City,
  CommercialVehicle,
  CommercialVehicleImage,
  Lead,
  Wishlist,
  CarReport,
  ReportReason,
  Notification,
} = require('../src/models');

describe('Phase 3 — Commercial Vehicle API Integration Tests', () => {
  let sellerUser, otherUser, adminUser;
  let sellerToken, otherToken, adminToken;
  let testBrand, testVehicleType, testState, testDistrict, testCity;
  let testCommercialVehicle;
  let testCar;
  let activeReason;

  const createdUserIds = [];
  const createdCommercialIds = [];
  const createdCarIds = [];

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
    // 1. Create Seller, Other User, and Admin User
    sellerUser = await User.create({
      full_name: 'Commercial Seller',
      phone: getUniquePhone(),
      email: `seller-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcommercialseller',
      role: 'dealer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(sellerUser.id);
    sellerToken = createToken(sellerUser);

    otherUser = await User.create({
      full_name: 'Other Customer',
      phone: getUniquePhone(),
      email: `other-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforothercustomer',
      role: 'customer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(otherUser.id);
    otherToken = createToken(otherUser);

    adminUser = await User.create({
      full_name: 'System Admin',
      phone: getUniquePhone(),
      email: `admin-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforadmin',
      role: 'admin',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(adminUser.id);
    adminToken = createToken(adminUser);

    // 2. Fetch or create reference data
    testBrand = await Brand.findOne({ where: { slug: 'ashok-leyland' } });
    if (!testBrand) {
      testBrand = await Brand.findOne();
    }

    testVehicleType = await VehicleType.findOne({ where: { slug: 'trucks' } });
    if (!testVehicleType) {
      testVehicleType = await VehicleType.findOne();
    }

    testState = await State.findOne();
    testDistrict = await District.findOne({ where: { state_id: testState.id } });
    testCity = await City.findOne({ where: { district_id: testDistrict.id } });

    // Model and Variant for car
    const [model] = await Model.findOrCreate({
      where: { name: 'Dost', brandId: testBrand.id },
      defaults: { name: 'Dost', brandId: testBrand.id },
    });
    const [variant] = await Variant.findOrCreate({
      where: { name: 'Strong', model_id: model.id },
      defaults: { name: 'Strong', model_id: model.id },
    });

    // 3. Ensure an active ReportReason exists
    [activeReason] = await ReportReason.findOrCreate({
      where: { value: 'incorrect_info' },
      defaults: {
        label: 'Incorrect Information',
        value: 'incorrect_info',
        is_active: true,
      },
    });

    // 4. Create a baseline car for comparison and unified tests
    testCar = await Car.create({
      user_id: sellerUser.id,
      brand_id: testBrand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2021,
      price: 550000,
      km_driven: 20000,
      ownership: '1st Owner',
      fuel_type: 'Diesel',
      transmission: 'Manual',
      body_type: 'Pickup',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'active',
    });
    createdCarIds.push(testCar.id);
  });

  afterAll(async () => {
    for (const id of createdCommercialIds) {
      await CommercialVehicleImage.destroy({ where: { commercial_vehicle_id: id } }).catch(() => {});
      await CommercialVehicle.destroy({ where: { id }, force: true }).catch(() => {});
    }
    for (const id of createdCarIds) {
      await Car.destroy({ where: { id }, force: true }).catch(() => {});
    }
    for (const id of createdUserIds) {
      await User.destroy({ where: { id }, force: true }).catch(() => {});
    }
  });

  describe('1. Commercial Vehicle Creation & Image Constraints', () => {
    it('fails with 400 when primary_image is completely missing', async () => {
      const res = await request(app)
        .post('/api/v1/commercial')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          vehicle_type_id: testVehicleType.id,
          brand_id: testBrand.id,
          year: 2022,
          fuel_type: 'Diesel',
          ownership: '1st Owner',
          km_driven: 45000,
          price: 1800000,
          description: 'Good condition tipper truck',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/primary image is required/i);
    });

    it('successfully creates commercial vehicle with valid Cloudinary URL images', async () => {
      const primaryUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/truck_primary.jpg';
      const secondaryUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/truck_sec1.jpg';

      const res = await request(app)
        .post('/api/v1/commercial')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          vehicle_type_id: testVehicleType.id,
          brand_id: testBrand.id,
          year: 2022,
          fuel_type: 'diesel',
          ownership: '1st owner',
          km_driven: 45000,
          price: 1850000,
          price_negotiable: true,
          description: 'Heavy duty commercial tipper',
          state_id: testState.id,
          district_id: testDistrict.id,
          city_id: testCity.id,
          primary_image: primaryUrl,
          secondary_images: [secondaryUrl],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.vehicle).toBeDefined();

      const created = res.body.data.vehicle;
      testCommercialVehicle = created;
      createdCommercialIds.push(created.id);

      expect(created.year).toBe(2022);
      expect(created.fuel_type).toBe('Diesel');
      expect(created.ownership).toBe('1st Owner');
      expect(created.price).toBe(1850000);
      expect(created.posted_by_type).toBe('dealer');
      expect(created.slug).toBeDefined();
      expect(created.primary_image).toContain('truck_primary.jpg');
      expect(created.secondary_images[0]).toContain('truck_sec1.jpg');
    });
  });

  describe('2. Route Ordering & Seller Listings', () => {
    it('GET /api/v1/commercial/me does not hit /:id route and returns seller listings', async () => {
      const res = await request(app)
        .get('/api/v1/commercial/me')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.vehicles).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);

      const found = res.body.data.vehicles.find((v) => v.id === testCommercialVehicle.id);
      expect(found).toBeDefined();
    });
  });

  describe('3. Public Listing Query & Sort Whitelist', () => {
    it('GET /api/v1/commercial returns matching envelope and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/commercial')
        .query({
          brand_id: testBrand.id,
          min_price: 1000000,
          max_price: 2000000,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('limit');
      expect(res.body.data).toHaveProperty('totalPages');
      expect(res.body.data).toHaveProperty('vehicles');
      expect(res.body.data).toHaveProperty('cars'); // component reuse alias
    });

    it('rejects invalid sort_by column with 400', async () => {
      const res = await request(app)
        .get('/api/v1/commercial')
        .query({
          sort_by: 'unauthorized_column; DROP TABLE users;',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be one of/i);
    });

    it('accepts valid sort_by=price with 200', async () => {
      const res = await request(app)
        .get('/api/v1/commercial')
        .query({
          sort_by: 'price',
          sort_order: 'ASC',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('accepts posted_within_days and include_expired combined with km, fuel_types, and price filters', async () => {
      const recentPetrol = await CommercialVehicle.create({
        user_id: sellerUser.id,
        vehicle_type_id: testVehicleType.id,
        brand_id: testBrand.id,
        year: 2024,
        fuel_type: 'Petrol',
        ownership: '1st Owner',
        km_driven: 23000,
        price: 590000,
        description: 'Recent petrol commercial test vehicle',
        state_id: testState.id,
        district_id: testDistrict.id,
        city_id: testCity.id,
        posted_by_type: 'dealer',
        status: 'active',
        slug: `petrol-filter-test-${Date.now()}`,
      });
      createdCommercialIds.push(recentPetrol.id);

      const res = await request(app)
        .get('/api/v1/commercial')
        .query({
          min_km: 0,
          max_km: 200000,
          fuel_types: 'Petrol',
          posted_within_days: 90,
          min_price: 100000,
          max_price: 5000000,
          include_expired: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const ids = res.body.data.vehicles.map((v) => v.id);
      expect(ids).toContain(recentPetrol.id);
    });

    it('enforces posted_within_days cutoff and include_expired flag properly', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const oldVehicle = await CommercialVehicle.create({
        user_id: sellerUser.id,
        vehicle_type_id: testVehicleType.id,
        brand_id: testBrand.id,
        year: 2023,
        fuel_type: 'Diesel',
        ownership: '1st Owner',
        km_driven: 40000,
        price: 900000,
        description: '15-day old commercial listing',
        state_id: testState.id,
        district_id: testDistrict.id,
        city_id: testCity.id,
        posted_by_type: 'dealer',
        status: 'active',
        slug: `old15-filter-test-${Date.now()}`,
      });
      createdCommercialIds.push(oldVehicle.id);
      await sequelize.query('UPDATE commercial_vehicles SET created_at = ? WHERE id = ?', {
        replacements: [fifteenDaysAgo, oldVehicle.id],
      });

      const oneHundredTwentyDaysAgo = new Date();
      oneHundredTwentyDaysAgo.setDate(oneHundredTwentyDaysAgo.getDate() - 120);
      const expiredVehicle = await CommercialVehicle.create({
        user_id: sellerUser.id,
        vehicle_type_id: testVehicleType.id,
        brand_id: testBrand.id,
        year: 2021,
        fuel_type: 'Diesel',
        ownership: '1st Owner',
        km_driven: 60000,
        price: 850000,
        description: '120-day old commercial listing',
        state_id: testState.id,
        district_id: testDistrict.id,
        city_id: testCity.id,
        posted_by_type: 'dealer',
        status: 'active',
        slug: `old120-filter-test-${Date.now()}`,
      });
      createdCommercialIds.push(expiredVehicle.id);
      await sequelize.query('UPDATE commercial_vehicles SET created_at = ? WHERE id = ?', {
        replacements: [oneHundredTwentyDaysAgo, expiredVehicle.id],
      });

      // posted_within_days=7 excludes 15-day and 120-day old listings, keeps today's testCommercialVehicle
      const res7 = await request(app)
        .get('/api/v1/commercial')
        .query({ brand_id: testBrand.id, posted_within_days: 7, limit: 100 });
      expect(res7.status).toBe(200);
      const ids7 = res7.body.data.vehicles.map((v) => v.id);
      expect(ids7).toContain(testCommercialVehicle.id);
      expect(ids7).not.toContain(oldVehicle.id);
      expect(ids7).not.toContain(expiredVehicle.id);

      // posted_within_days=30 includes 15-day old listing, still excludes 120-day old listing
      const res30 = await request(app)
        .get('/api/v1/commercial')
        .query({ brand_id: testBrand.id, posted_within_days: 30, limit: 100 });
      expect(res30.status).toBe(200);
      const ids30 = res30.body.data.vehicles.map((v) => v.id);
      expect(ids30).toContain(oldVehicle.id);
      expect(ids30).not.toContain(expiredVehicle.id);

      // posted_within_days=180 & include_expired=false enforces 90-day cutoff
      const res180NoExp = await request(app)
        .get('/api/v1/commercial')
        .query({ brand_id: testBrand.id, posted_within_days: 180, include_expired: false, limit: 100 });
      expect(res180NoExp.status).toBe(200);
      expect(res180NoExp.body.data.vehicles.map((v) => v.id)).not.toContain(expiredVehicle.id);

      // posted_within_days=180 & include_expired=true includes 120-day old listing
      const res180WithExp = await request(app)
        .get('/api/v1/commercial')
        .query({ brand_id: testBrand.id, posted_within_days: 180, include_expired: true, limit: 100 });
      expect(res180WithExp.status).toBe(200);
      expect(res180WithExp.body.data.vehicles.map((v) => v.id)).toContain(expiredVehicle.id);
    });

    it('rejects invalid posted_within_days with 400', async () => {
      const res = await request(app)
        .get('/api/v1/commercial')
        .query({ posted_within_days: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Listing Detail & PII Masking', () => {
    it('masks seller phone and email for public / unauthenticated viewer', async () => {
      const res = await request(app)
        .get(`/api/v1/commercial/${testCommercialVehicle.id}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const vehicle = res.body.data.vehicle;
      expect(vehicle.seller).toBeDefined();
      expect(vehicle.seller.phone).toContain('***');
      expect(vehicle.seller.email).toContain('***');
    });

    it('does NOT mask seller phone and email for the listing owner', async () => {
      const res = await request(app)
        .get(`/api/v1/commercial/${testCommercialVehicle.id}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      const vehicle = res.body.data.vehicle;
      expect(vehicle.seller.phone).toBe(sellerUser.phone);
      expect(vehicle.seller.email).toBe(sellerUser.email);
    });

    it('does NOT mask seller phone and email for admin', async () => {
      const res = await request(app)
        .get(`/api/v1/commercial/${testCommercialVehicle.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const vehicle = res.body.data.vehicle;
      expect(vehicle.seller.phone).toBe(sellerUser.phone);
      expect(vehicle.seller.email).toBe(sellerUser.email);
    });
  });

  describe('5. Ownership Checks (PATCH & DELETE Authorization)', () => {
    it('User B cannot PATCH User A listing (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/commercial/${testCommercialVehicle.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ price: 1700000 });

      expect(res.status).toBe(403);
    });

    it('User B cannot DELETE User A listing (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/commercial/${testCommercialVehicle.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it('Owner can PATCH listing successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/commercial/${testCommercialVehicle.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price: 1800000 });

      expect(res.status).toBe(200);
      expect(res.body.data.vehicle.price).toBe(1800000);
    });
  });

  describe('6. Image Sub-resources', () => {
    it('sets secondary image as new primary image', async () => {
      const images = testCommercialVehicle.images || [];
      const secondary = images.find((img) => !img.is_primary);

      if (secondary) {
        const res = await request(app)
          .patch(`/api/v1/commercial/${testCommercialVehicle.id}/images/${secondary.id}/primary`)
          .set('Authorization', `Bearer ${sellerToken}`);

        expect(res.status).toBe(200);

        // Fetch detail to confirm
        const detailRes = await request(app)
          .get(`/api/v1/commercial/${testCommercialVehicle.id}`)
          .set('Authorization', `Bearer ${sellerToken}`);

        const updatedImages = detailRes.body.data.vehicle.images;
        const newPrimary = updatedImages.find((img) => img.id === secondary.id);
        expect(newPrimary.is_primary).toBe(true);
      }
    });
  });

  describe('7. Cross-Cutting Polymorphic Interactions', () => {
    it('creates an enquiry/lead on a commercial vehicle and seller receives it in inbox', async () => {
      const res = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          target_type: 'commercial',
          target_id: testCommercialVehicle.id,
          source: 'message',
          message: 'Interested in buying this tipper truck',
          contact_phone: '9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();

      // Seller checks lead inbox
      const inboxRes = await request(app)
        .get('/api/v1/leads/seller/leads')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(inboxRes.status).toBe(200);
      expect(inboxRes.body.data.leads).toBeInstanceOf(Array);
      const leadFound = inboxRes.body.data.leads.find((l) => l.buyer_id === otherUser.id);
      expect(leadFound).toBeDefined();
    });

    it('toggles wishlist on a commercial vehicle', async () => {
      // Add to wishlist
      const addRes = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          target_type: 'commercial',
          target_id: testCommercialVehicle.id,
        });

      expect(addRes.status).toBe(200);
      expect(addRes.body.success).toBe(true);

      // Verify detail reflects isWishlist = true
      const detailRes = await request(app)
        .get(`/api/v1/commercial/${testCommercialVehicle.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(detailRes.body.data.vehicle.isWishlist).toBe(true);
    });

    it('submits a report on a commercial vehicle', async () => {
      const res = await request(app)
        .post('/api/v1/car-reports')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          target_type: 'commercial',
          target_id: testCommercialVehicle.id,
          reason: 'incorrect_info',
          description: 'Year of manufacturing does not match RC book',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('admin pending moderation queue lists commercial vehicle and approves it', async () => {
      // 1. List pending commercial listings
      const pendingRes = await request(app)
        .get('/api/v1/admin/listings/pending')
        .query({ target_type: 'commercial' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(pendingRes.status).toBe(200);
      expect(pendingRes.body.data.listings).toBeInstanceOf(Array);

      // 2. Approve listing
      const approveRes = await request(app)
        .patch(`/api/v1/admin/listings/${testCommercialVehicle.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target_type: 'commercial' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);

      // 3. Confirm notification was generated for seller
      const notif = await Notification.findOne({
        where: {
          user_id: sellerUser.id,
          target_type: 'commercial',
          target_id: testCommercialVehicle.id,
        },
      });
      expect(notif).toBeDefined();
    });
  });

  describe('8. Unified Global Search Endpoint', () => {
    it('GET /api/v1/search?target_type=all returns results across cars and commercial vehicles', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .query({
          target_type: 'all',
          limit: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.results).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);

      const targetTypes = res.body.data.results.map((r) => r.target_type);
      expect(targetTypes).toBeDefined();
    });

    it('GET /api/v1/search?target_type=commercial returns commercial results', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .query({
          target_type: 'commercial',
          limit: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.target_type).toBe('commercial');
      expect(res.body.data.results).toBeInstanceOf(Array);
    });
  });
});
