'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const {
  User,
  Car,
  Brand,
  Model,
  Variant,
  CarReport,
  ReportReason,
} = require('../src/models');

describe('Report Reasons API (Public GET + Admin CRUD) Integration Tests', () => {
  let adminToken;
  let customerToken;
  let adminUser;
  let customerUser;
  let dealerUser;
  let testCar;

  const createdReasonIds = [];
  const createdReportIds = [];
  const createdCarIds = [];
  const createdUserIds = [];

  const setupUser = async (role = 'customer') => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const user = await User.create({
      full_name: `${role.toUpperCase()} User ${randomId}`,
      phone: `9${randomId}009`,
      email: `${role}-${randomId}@test.com`,
      password_hash: '$2a$12$dummyhashforreportreasontester',
      role,
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(user.id);
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'f49f544a6d7f0399b773e3fa5a3cdaf512ee07f65ca5790065bfce713cde7e16157e8c8be28288e591f25596295f5dcde6dba4a33280bc4bd93b088382fda62b',
      { expiresIn: '1h' }
    );
    return { token, user };
  };

  beforeAll(async () => {
    // 1. Setup Admin User
    const admin = await setupUser('admin');
    adminToken = admin.token;
    adminUser = admin.user;

    // 2. Setup Customer User
    const customer = await setupUser('customer');
    customerToken = customer.token;
    customerUser = customer.user;

    // 3. Setup Dealer User
    const dealer = await setupUser('dealer');
    dealerUser = dealer.user;

    // 4. Create Brand, Model, Variant
    const [brand] = await Brand.findOrCreate({
      where: { name: 'Hyundai' },
      defaults: { name: 'Hyundai' },
    });
    const [model] = await Model.findOrCreate({
      where: { name: 'Verna', brand_id: brand.id },
      defaults: { name: 'Verna', brandId: brand.id, bodyType: 'Sedan' },
    });
    const [variant] = await Variant.findOrCreate({
      where: { name: 'SX(O)', model_id: model.id },
      defaults: { name: 'SX(O)', model_id: model.id },
    });

    // 5. Create Test Car
    testCar = await Car.create({
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2023,
      price: 1600000,
      km_driven: 12000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Sedan',
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
    if (createdReasonIds.length > 0) {
      await ReportReason.destroy({ where: { id: createdReasonIds } }).catch(() => {});
    }
    if (createdCarIds.length > 0) {
      await Car.destroy({ where: { id: createdCarIds } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: createdUserIds } }).catch(() => {});
    }
  });

  // ── 1. Public: Get Report Reasons (dropdown) ────────────────────────
  test('1. GET /api/v1/report-reasons - returns only active reasons, sorted, with only id, label, value', async () => {
    // Create an inactive reason to verify it gets filtered out
    const inactiveReason = await ReportReason.create({
      label: 'Inactive Test Reason',
      value: 'inactive_test_reason_1',
      is_active: false,
      sort_order: 99,
      description: 'Internal inactive reason',
    });
    createdReasonIds.push(inactiveReason.id);

    const res = await request(app).get('/api/v1/report-reasons');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['cache-control']).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(8);

    // Verify inactive reason is NOT present
    const foundInactive = res.body.data.find((r) => r.value === 'inactive_test_reason_1');
    expect(foundInactive).toBeUndefined();

    // Verify response structure only exposes id, label, value
    for (const item of res.body.data) {
      expect(item.id).toBeDefined();
      expect(item.label).toBeDefined();
      expect(item.value).toBeDefined();
      expect(item.description).toBeUndefined();
      expect(item.created_at).toBeUndefined();
      expect(item.createdAt).toBeUndefined();
    }

    // Verify sorting by sort_order / label
    const values = res.body.data.map((r) => r.value);
    expect(values[0]).toBe('car_sold_out');
  });

  // ── 2. Public: Dual Mount Route /api/report-reasons ─────────────────
  test('2. GET /api/report-reasons - unversioned route returns active reasons', async () => {
    const res = await request(app).get('/api/report-reasons');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ── 3. Admin: List All Reasons (active + inactive) ───────────────────
  test('3. GET /api/v1/admin/report-reasons - Admin lists all reasons with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/admin/report-reasons?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reasons).toBeDefined();
    expect(res.body.data.total).toBeGreaterThanOrEqual(9); // 8 seeded + 1 inactive
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(20);

    // Both active and inactive should be returned
    const inactiveFound = res.body.data.reasons.find((r) => r.value === 'inactive_test_reason_1');
    expect(inactiveFound).toBeDefined();
    expect(inactiveFound.isActive).toBe(false);
  });

  // ── 4. Admin: Filter & Search ───────────────────────────────────────
  test('4. GET /api/v1/admin/report-reasons?isActive=false & ?search=sold', async () => {
    // Filter by inactive
    const filterRes = await request(app)
      .get('/api/v1/admin/report-reasons?isActive=false')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(filterRes.status).toBe(200);
    for (const r of filterRes.body.data.reasons) {
      expect(r.isActive).toBe(false);
    }

    // Search by keyword
    const searchRes = await request(app)
      .get('/api/v1/admin/report-reasons?search=sold')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.reasons.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.data.reasons[0].value).toBe('car_sold_out');
  });

  // ── 5. Admin: Get Single Reason by ID ───────────────────────────────
  test('5. GET /api/v1/admin/report-reasons/:id - returns full record; 404 for missing', async () => {
    const existing = await ReportReason.findOne({ where: { value: 'car_sold_out' } });

    const res = await request(app)
      .get(`/api/v1/admin/report-reasons/${existing.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reason.id).toBe(existing.id);
    expect(res.body.data.reason.label).toBe('Car Sold Out');
    expect(res.body.data.reason.value).toBe('car_sold_out');
    expect(res.body.data.reason.isActive).toBe(true);
    expect(res.body.data.reason.createdAt).toBeDefined();

    // 404 test
    const notFoundRes = await request(app)
      .get('/api/v1/admin/report-reasons/b0000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.success).toBe(false);
  });

  // ── 6. Admin: Create Report Reason ──────────────────────────────────
  test('6. POST /api/v1/admin/report-reasons - creates new report reason successfully', async () => {
    const payload = {
      label: 'Suspicious Odometer Reading',
      value: 'suspicious_odometer_test',
      isActive: true,
      sortOrder: 10,
      description: 'Mileage in photo contradicts digital instrument cluster',
    };

    const res = await request(app)
      .post('/api/v1/admin/report-reasons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reason).toBeDefined();
    expect(res.body.data.reason.label).toBe(payload.label);
    expect(res.body.data.reason.value).toBe(payload.value);
    expect(res.body.data.reason.isActive).toBe(true);
    expect(res.body.data.reason.sortOrder).toBe(10);
    expect(res.body.data.reason.description).toBe(payload.description);

    createdReasonIds.push(res.body.data.reason.id);
  });

  // ── 7. Admin: Reject Duplicate Value ────────────────────────────────
  test('7. POST /api/v1/admin/report-reasons - rejects duplicate value with 400', async () => {
    const res = await request(app)
      .post('/api/v1/admin/report-reasons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        label: 'Duplicate Car Sold',
        value: 'car_sold_out', // already exists
        sortOrder: 5,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ── 8. Admin: Reject Invalid Snake Case Value ───────────────────────
  test('8. POST /api/v1/admin/report-reasons - rejects non-snake_case values', async () => {
    const res = await request(app)
      .post('/api/v1/admin/report-reasons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        label: 'Invalid Value Format',
        value: 'Invalid-Reason-Value!',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/snake_case/i);
  });

  // ── 9. Admin: Update Report Reason ──────────────────────────────────
  test('9. PATCH /api/v1/admin/report-reasons/:id - partial update works and preserves uniqueness', async () => {
    const reasonToUpdate = await ReportReason.create({
      label: 'Temporary Reason',
      value: 'temporary_reason_edit',
      is_active: true,
      sort_order: 50,
    });
    createdReasonIds.push(reasonToUpdate.id);

    // Update label and sortOrder
    const updateRes = await request(app)
      .patch(`/api/v1/admin/report-reasons/${reasonToUpdate.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        label: 'Updated Temporary Reason',
        sortOrder: 55,
        isActive: false,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.reason.label).toBe('Updated Temporary Reason');
    expect(updateRes.body.data.reason.sortOrder).toBe(55);
    expect(updateRes.body.data.reason.isActive).toBe(false);

    // Attempt to update value to an already taken value
    const duplicateRes = await request(app)
      .patch(`/api/v1/admin/report-reasons/${reasonToUpdate.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        value: 'car_sold_out',
      });

    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.success).toBe(false);
    expect(duplicateRes.body.message).toMatch(/already exists/i);
  });

  // ── 10. Admin: Block Deletion if Referenced by Existing Car Report ──
  test('10. DELETE /api/v1/admin/report-reasons/:id - blocks deletion if referenced by existing report', async () => {
    // Create a specific reason
    const reasonForReport = await ReportReason.create({
      label: 'Referenced Reason',
      value: 'referenced_reason_test',
      is_active: true,
      sort_order: 80,
    });
    createdReasonIds.push(reasonForReport.id);

    // Create a CarReport using this reason
    const report = await CarReport.create({
      car_id: testCar.id,
      dealer_id: dealerUser.id,
      reporter_id: customerUser.id,
      reporter_name: customerUser.full_name,
      reporter_phone: customerUser.phone,
      reason: 'referenced_reason_test',
      status: 'pending',
    });
    createdReportIds.push(report.id);

    // Attempt to delete the referenced reason
    const deleteRes = await request(app)
      .delete(`/api/v1/admin/report-reasons/${reasonForReport.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.success).toBe(false);
    expect(deleteRes.body.message).toMatch(/referenced by.*existing car report/i);

    // Verify reason was NOT deleted from DB
    const stillExists = await ReportReason.findByPk(reasonForReport.id);
    expect(stillExists).not.toBeNull();
  });

  // ── 11. Admin: Delete Unreferenced Report Reason ─────────────────────
  test('11. DELETE /api/v1/admin/report-reasons/:id - deletes unreferenced reason', async () => {
    const unreferencedReason = await ReportReason.create({
      label: 'Safe to Delete Reason',
      value: 'safe_to_delete_test',
      is_active: true,
      sort_order: 85,
    });

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/report-reasons/${unreferencedReason.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const check = await ReportReason.findByPk(unreferencedReason.id);
    expect(check).toBeNull();
  });

  // ── 12. Security & Validation: 401 / 403 on Admin Routes ─────────────
  test('12. Security - reject unauthorized and non-admin requests to admin CRUD', async () => {
    // Unauthenticated (no token) -> 401
    const unauthRes = await request(app).get('/api/v1/admin/report-reasons');
    expect(unauthRes.status).toBe(401);

    // Non-admin customer -> 403
    const forbiddenRes = await request(app)
      .get('/api/v1/admin/report-reasons')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbiddenRes.status).toBe(403);

    // Non-admin trying to create -> 403
    const createForbidden = await request(app)
      .post('/api/v1/admin/report-reasons')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ label: 'Unauthorized', value: 'unauthorized_val' });
    expect(createForbidden.status).toBe(403);
  });

  // ── 13. Dynamic Car Report Validation: Enforce Active Reason ──────────
  test('13. POST /api/v1/car-reports - validates submitted reason against active ReportReason records', async () => {
    // Submitting with inactive reason should be rejected with 400
    const resInactive = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: testCar.id,
        reason: 'inactive_test_reason_1',
      });

    expect(resInactive.status).toBe(400);
    expect(resInactive.body.success).toBe(false);
    expect(resInactive.body.message).toMatch(/valid active reason/i);

    // Submitting with completely invalid/unknown reason -> 400
    const resUnknown = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: testCar.id,
        reason: 'totally_unknown_reason_key',
      });

    expect(resUnknown.status).toBe(400);
    expect(resUnknown.body.success).toBe(false);
    expect(resUnknown.body.message).toMatch(/valid active reason/i);

    // Submitting with dynamically added active reason -> 201 Success
    const dynamicReason = await ReportReason.create({
      label: 'Accidental Damage Hidden',
      value: 'accidental_damage_hidden',
      is_active: true,
      sort_order: 12,
    });
    createdReasonIds.push(dynamicReason.id);

    const resValid = await request(app)
      .post('/api/v1/car-reports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        car_id: testCar.id,
        reason: 'accidental_damage_hidden',
        description: 'Chassis repair weld marks found under door sill.',
      });

    expect(resValid.status).toBe(201);
    expect(resValid.body.success).toBe(true);
    expect(resValid.body.data.report.reason).toBe('accidental_damage_hidden');
    createdReportIds.push(resValid.body.data.report.id);
  });
});
