// tests/polymorphic-phase1.test.js
process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { User, Car, Brand, Model, Variant, Lead, Wishlist, Notification, Requirement } = require('../src/models');
const { randomUUID } = require('crypto');

describe('Phase 1 — Polymorphic Refactor Integration Tests', () => {
  let customerUser, customerToken;
  let dealerUser, dealerToken;
  let testCar;
  let testRequirement;
  const createdUserIds = [];
  const createdCarIds = [];
  const createdLeadIds = [];
  const createdWishlistIds = [];
  const createdNotificationIds = [];
  const createdRequirementIds = [];

  const getUniquePhone = () => {
    return '9' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);
  };

  beforeAll(async () => {
    // 1. Create Dealer
    dealerUser = await User.create({
      full_name: 'Dealer Seller Phase1',
      phone: getUniquePhone(),
      email: `dealer-p1-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashfordealerphase1',
      role: 'dealer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(dealerUser.id);
    dealerToken = jwt.sign(
      { id: dealerUser.id, role: dealerUser.role },
      process.env.JWT_SECRET || 'pre_owned_cars_jwt_secret',
      { expiresIn: '1h' }
    );

    // 2. Create Customer
    customerUser = await User.create({
      full_name: 'Customer Buyer Phase1',
      phone: getUniquePhone(),
      email: `customer-p1-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcustomerphase1',
      role: 'customer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(customerUser.id);
    customerToken = jwt.sign(
      { id: customerUser.id, role: customerUser.role },
      process.env.JWT_SECRET || 'pre_owned_cars_jwt_secret',
      { expiresIn: '1h' }
    );

    // 3. Catalog setup
    const [brand] = await Brand.findOrCreate({
      where: { name: 'Toyota' },
      defaults: { name: 'Toyota' },
    });
    const [model] = await Model.findOrCreate({
      where: { name: 'Innova', brandId: brand.id },
      defaults: { name: 'Innova', brandId: brand.id, bodyType: 'MUV' },
    });
    const [variant] = await Variant.findOrCreate({
      where: { name: 'Crysta', model_id: model.id },
      defaults: { name: 'Crysta', model_id: model.id },
    });

    // 4. Test Car
    testCar = await Car.create({
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2023,
      price: 2200000,
      km_driven: 15000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'MUV',
      board_type: 'Own Board',
      status: 'active',
      posted_by_type: 'dealer',
    });
    createdCarIds.push(testCar.id);

    // 5. Test Requirement
    testRequirement = await Requirement.create({
      user_id: customerUser.id,
      brand_id: brand.id,
      model_id: model.id,
      body_type: 'MUV',
      board_type: 'Own Board',
      purchase_plan_days: 30,
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      fuel_type: 'Diesel',
      status: 'active',
    });
    createdRequirementIds.push(testRequirement.id);
  });

  afterAll(async () => {
    for (const id of createdNotificationIds) {
      await Notification.destroy({ where: { id } }).catch(() => {});
    }
    for (const id of createdWishlistIds) {
      await Wishlist.destroy({ where: { id } }).catch(() => {});
    }
    for (const id of createdLeadIds) {
      await Lead.destroy({ where: { id } }).catch(() => {});
    }
    for (const id of createdRequirementIds) {
      await Requirement.destroy({ where: { id } }).catch(() => {});
    }
    for (const id of createdCarIds) {
      await Car.destroy({ where: { id }, force: true }).catch(() => {});
    }
    for (const id of createdUserIds) {
      await User.destroy({ where: { id } }).catch(() => {});
    }
  });

  // ── Test 1: createLead with target_type='commercial' returns clean 4xx without crashing ──
  test('1. createLead with target_type="commercial" returns clean 4xx without crashing', async () => {
    const commercialUuid = randomUUID();
    const res = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        target_type: 'commercial',
        target_id: commercialUuid,
        source: 'message',
        message: 'Interested in this commercial vehicle',
      });

    // Must return 4xx (404 Not Found since commercial doesn't exist in Phase 1)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/commercial vehicle not found/i);
  });

  // ── Test 2: wishlist toggle dual-writes car_id and target_id ──
  test('2. wishlist toggle dual-writes car_id and target_id', async () => {
    const res = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ carId: testCar.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_wishlisted).toBe(true);

    // Verify row in database has both car_id and target_id populated identically
    const wishlistItem = await Wishlist.findOne({
      where: {
        user_id: customerUser.id,
        car_id: testCar.id,
      },
    });

    expect(wishlistItem).not.toBeNull();
    createdWishlistIds.push(wishlistItem.id);

    expect(wishlistItem.car_id).toBe(testCar.id);
    expect(wishlistItem.target_id).toBe(testCar.id);
    expect(wishlistItem.target_type).toBe('car');

    // Untoggle to restore state
    const untoggleRes = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ carId: testCar.id });

    expect(untoggleRes.status).toBe(200);
    expect(untoggleRes.body.is_wishlisted).toBe(false);
  });

  // ── Test 3: notification created with only requirement_id (null car_id) succeeds ──
  test('3. notification created with only requirement_id (null car_id) succeeds', async () => {
    const notification = await Notification.create({
      user_id: customerUser.id,
      requirement_id: testRequirement.id,
      car_id: null,
      target_type: 'car',
      target_id: null,
      type: 'requirement_alert',
      message: 'A new requirement notification with null car_id',
    });

    expect(notification).toBeDefined();
    expect(notification.id).toBeDefined();
    createdNotificationIds.push(notification.id);

    // Reload from database to verify persistence
    const saved = await Notification.findByPk(notification.id);
    expect(saved).not.toBeNull();
    expect(saved.car_id).toBeNull();
    expect(saved.requirement_id).toBe(testRequirement.id);
    expect(saved.user_id).toBe(customerUser.id);
  });
});
