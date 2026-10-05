// tests/car-report.test.js
process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { User, Car, CarReport, Brand, Model, Variant } = require('../src/models');

describe('Car Report ("Report This Listing") Integration Tests', () => {
  let adminUser, adminToken;
  let dealerUser, dealerToken;
  let customerUser, customerToken;
  let testCar;
  const createdUserIds = [];
  const createdCarIds = [];
  const createdReportIds = [];

  const getUniquePhone = () => {
    return '9' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);
  };

  beforeAll(async () => {
    // 1. Create Admin
    adminUser = await User.create({
      full_name: 'Admin Report Tester',
      phone: getUniquePhone(),
      email: `admin-rep-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforadminreporttester',
      role: 'admin',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(adminUser.id);
    adminToken = jwt.sign(
      { id: adminUser.id, role: adminUser.role },
      process.env.JWT_SECRET || 'pre_owned_cars_jwt_secret',
      { expiresIn: '1h' }
    );

    // 2. Create Dealer (owner of test car)
    dealerUser = await User.create({
      full_name: 'Dealer Seller Report Tester',
      phone: getUniquePhone(),
      email: `dealer-rep-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashfordealerreporttester',
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

    // 3. Create Customer
    customerUser = await User.create({
      full_name: 'Customer Reporter',
      phone: getUniquePhone(),
      email: `customer-rep-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcustomerreporttester',
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

    // 4. Create Brand, Model & Variant for Car
    const [brand] = await Brand.findOrCreate({
      where: { name: 'Hyundai' },
      defaults: { name: 'Hyundai' },
    });
    const [model] = await Model.findOrCreate({
      where: { name: 'Creta', brandId: brand.id },
      defaults: { name: 'Creta', brandId: brand.id, bodyType: 'SUV' },
    });
    const [variant] = await Variant.findOrCreate({
      where: { name: 'SX', model_id: model.id },
      defaults: { name: 'SX', model_id: model.id },
    });

    // 5. Create Test Car owned by dealerUser
    testCar = await Car.create({
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2022,
      price: 1450000,
      km_driven: 18000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      status: 'active',
      posted_by_type: 'dealer',
    });
    createdCarIds.push(testCar.id);
  });

  afterAll(async () => {
    if (createdReportIds.length > 0) {
      await CarReport.destroy({ where: { id: createdReportIds } }).catch(() => {});
    }
    if (createdCarIds.length > 0) {
      await Car.destroy({ where: { id: createdCarIds } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: createdUserIds } }).catch(() => {});
    }
  });

  // ── 1. Authenticated User Submits Report ─────────────────────────────
  test('1. POST /api/v1/car-reports - Logged-in user reports listing successfully', async () => {
    const payload = {
      car_id: testCar.id,
      reason: 'car_sold_out',
      description: 'Called dealer, car has already been sold yesterday.',
    };

    const res = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report).toBeDefined();

    const report = res.body.data.report;
    createdReportIds.push(report.id);

    expect(report.car_id).toBe(testCar.id);
    expect(report.dealer_id).toBe(dealerUser.id);
    expect(report.reporter_id).toBe(customerUser.id);
    expect(report.reporter_name).toBe(customerUser.full_name);
    expect(report.reporter_phone).toBe(customerUser.phone);
    expect(report.reason).toBe('car_sold_out');
    expect(report.description).toBe(payload.description);
    expect(report.status).toBe('pending');
    expect(report.admin_notes).toBeNull();
    expect(report.resolved_at).toBeNull();
  });

  // ── 2. Guest User Rejected (401) ───────────────────────────────────
  test('2. POST /api/v1/car-reports - Guest user is rejected with 401 Unauthorized', async () => {
    const payload = {
      car_id: testCar.id,
      dealer_id: dealerUser.id,
      reason: 'fraudulent_listing',
      description: 'Photos appear to be stolen from an overseas website.',
      reporter_name: 'Guest Observer',
      reporter_phone: '9876543210',
    };

    const res = await request(app)
      .post('/api/v1/car-reports')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── 3. Validation: Reject Invalid Reason ────────────────────────────
  test('3. POST /api/v1/car-reports - Reject invalid reason enum', async () => {
    const res = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: testCar.id,
        reason: 'some_random_reason',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/reason/i);
  });

  // ── 4. Validation: Reject Non-Existent Car ──────────────────────────
  test('4. POST /api/v1/car-reports - Reject non-existent car_id (404)', async () => {
    const fakeCarId = 'a0000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: fakeCarId,
        reason: 'overpriced_car',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/car listing not found/i);
  });

  // ── 5. Registered User Reporting another reason ───────────────────
  test('5. POST /api/v1/car-reports - Registered user submits report with reason dealer_listed_as_individual', async () => {
    const res = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: testCar.id,
        reason: 'dealer_listed_as_individual',
        description: 'Listing says individual seller but location is a commercial showroom.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.reason).toBe('dealer_listed_as_individual');
    expect(res.body.data.report.reporter_id).toBe(customerUser.id);
    createdReportIds.push(res.body.data.report.id);
  });

  // ── 6. Validation: Reject Unknown Fields (unknown: false) ───────────
  test('6. POST /api/v1/car-reports - Reject unknown fields', async () => {
    const res = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: testCar.id,
        reason: 'incorrect_info',
        malicious_field: 'injected_value',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/malicious_field/i);
  });

  // ── 7. Admin: Get All Reports ───────────────────────────────────────
  test('7. GET /api/v1/car-reports - Admin retrieves paginated reports', async () => {
    const res = await request(app)
      .get('/api/v1/car-reports')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.reports)).toBe(true);
    expect(res.body.data.reports.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
  });

  // ── 8. Admin: Filter Reports by Status ──────────────────────────────
  test('8. GET /api/v1/car-reports?status=pending - Admin filters reports by status', async () => {
    const res = await request(app)
      .get('/api/v1/car-reports?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const rep of res.body.data.reports) {
      expect(rep.status).toBe('pending');
    }
  });

  // ── 9. Admin: Update Report Status & Admin Notes ────────────────────
  test('9. PATCH /api/v1/car-reports/:id - Admin updates status to in_review with admin_notes', async () => {
    const targetReportId = createdReportIds[0];

    const res = await request(app)
      .patch(`/api/v1/car-reports/${targetReportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'in_review',
        admin_notes: 'Called dealer at 10:30 AM. Dealer confirmed vehicle status.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.status).toBe('in_review');
    expect(res.body.data.report.admin_notes).toContain('Called dealer');
    expect(res.body.data.report.resolved_at).toBeNull();
  });

  // ── 10. Admin: Resolve Report and Auto-Timestamp resolved_at ────────
  test('10. PATCH /api/v1/car-reports/:id - Admin resolves report -> resolved_at set', async () => {
    const targetReportId = createdReportIds[0];

    const res = await request(app)
      .patch(`/api/v1/car-reports/${targetReportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'resolved',
        admin_notes: 'Listing updated by dealer. Issue resolved.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.status).toBe('resolved');
    expect(res.body.data.report.resolved_at).toBeTruthy();
  });

  // ── 11. Security: Non-Admin Forbidden from Reviewing Reports ─────────
  test('11. Security - Customer forbidden from accessing admin report listing', async () => {
    const res = await request(app)
      .get('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ── 12. Dual Mount: Verify /api/v1/admin/car-reports works ───────────
  test('12. Dual Mount - Admin can access via /api/v1/admin/car-reports', async () => {
    const res = await request(app)
      .get('/api/v1/admin/car-reports')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.reports)).toBe(true);
  });
});
