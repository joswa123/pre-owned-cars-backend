// tests/admin-approval.test.js
process.env.NODE_ENV = 'test';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { User, CustomerProfile, DealerProfile } = require('../src/models');

describe('Admin Approval Flow Integration Tests', () => {
  let adminUser;
  let adminToken;
  const createdUserIds = [];

  const getUniquePhone = () => {
    return '9' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);
  };

  const getTestCustomer = (custom = {}) => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Approval Test User ${randomId}`,
      phone: getUniquePhone(),
      email: `approval-test-${randomId}@example.com`,
      password: 'Password@123',
      role: 'customer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
      ...custom,
    };
  };

  const getTestDealer = (custom = {}) => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `Approval Dealer ${randomId}`,
      phone: getUniquePhone(),
      email: `approval-dealer-${randomId}@example.com`,
      password: 'Password@123',
      role: 'dealer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
      company_name: `Speed Motors ${randomId}`,
      door_no: '12B',
      building_name: 'Auto Plaza',
      street_name: 'Cross Cut Road',
      pincode: '641012',
      ...custom,
    };
  };

  beforeAll(async () => {
    // Create an Admin user with status 'approved'
    adminUser = await User.create({
      full_name: 'Super Admin Test',
      phone: getUniquePhone(),
      email: `admin-approval-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$e8Y5M65p060wF1kK7w16l.3tJ2kM7JmP8C4x8H9nK6X.F9WjZ2e9u', // dummy hash
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
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: createdUserIds } }).catch(() => {});
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. REGISTRATION: New user is created with status = 'pending' and is_verified = false
  // ─────────────────────────────────────────────────────────────────────────────
  test('1. Registration creates user with status="pending" and is_verified=false', async () => {
    const customer = getTestCustomer();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('userId');

    const createdUser = await User.findByPk(res.body.data.userId);
    expect(createdUser).not.toBeNull();
    expect(createdUser.status).toBe('pending');
    expect(createdUser.is_verified).toBe(false);
    createdUserIds.push(createdUser.id);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. OTP VERIFICATION: Sets is_verified = true, status remains 'pending'
  // ─────────────────────────────────────────────────────────────────────────────
  test('2. OTP Verification sets is_verified=true, status remains "pending"', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);
    const otp = regRes.body.data.otp;

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify')
      .send({
        email: customer.email,
        code: otp,
      });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.status).toBe('success');

    const verifiedUser = await User.findByPk(userId);
    expect(verifiedUser.is_verified).toBe(true);
    expect(verifiedUser.status).toBe('pending');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. LOGIN GUARD: Attempting to login with pending status fails with 403
  // ─────────────────────────────────────────────────────────────────────────────
  test('3. Login attempt with pending status fails with 403 and pending approval message', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);
    const otp = regRes.body.data.otp;

    // Verify OTP
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: otp });

    // Try logging in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: customer.password,
      });

    expect(loginRes.statusCode).toBe(403);
    expect(loginRes.body.status).toBe('error');
    expect(loginRes.body.message).toBe('Your account is pending admin approval. Please wait.');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. AUTH MIDDLEWARE: Accessing protected endpoints with pending token fails with 403
  // ─────────────────────────────────────────────────────────────────────────────
  test('4. Accessing protected endpoint with pending user token returns 403', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);
    const otp = regRes.body.data.otp;

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: otp });

    const userToken = verifyRes.body.data.accessToken;

    const profileRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(profileRes.statusCode).toBe(403);
    expect(profileRes.body.message).toBe('Your account is pending admin approval. Please wait.');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ADMIN LISTING & COUNT: Admin sees pending users, non-admin blocked
  // ─────────────────────────────────────────────────────────────────────────────
  test('5. Admin can list pending users and get count; non-admin receives 403', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);
    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);

    // Non-admin attempt without token
    const unauthRes = await request(app).get('/api/v1/admin/users/pending');
    expect(unauthRes.statusCode).toBe(401);

    // Non-admin attempt with customer token
    const tempUser = await User.create({
      full_name: 'Normal Customer',
      phone: getUniquePhone(),
      email: `cust-${Date.now()}@test.com`,
      password_hash: 'dummy',
      role: 'customer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(tempUser.id);
    const custToken = jwt.sign(
      { id: tempUser.id, role: tempUser.role },
      process.env.JWT_SECRET || 'pre_owned_cars_jwt_secret',
      { expiresIn: '1h' }
    );

    const forbiddenRes = await request(app)
      .get('/api/v1/admin/users/pending')
      .set('Authorization', `Bearer ${custToken}`);
    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.body.message).toContain('Admin access required');

    // Admin count endpoint
    const countRes = await request(app)
      .get('/api/v1/admin/users/pending/count')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(countRes.statusCode).toBe(200);
    expect(countRes.body.status).toBe('success');
    expect(typeof countRes.body.data.count).toBe('number');
    expect(countRes.body.data.count).toBeGreaterThanOrEqual(1);

    // Admin pending listing
    const listRes = await request(app)
      .get('/api/v1/admin/users/pending?page=1&limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.status).toBe('success');
    expect(Array.isArray(listRes.body.data.users)).toBe(true);
    expect(listRes.body.data.pagination).toHaveProperty('total');

    const found = listRes.body.data.users.find((u) => u.id === userId);
    expect(found).toBeDefined();
    expect(found.status).toBe('pending');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. ADMIN APPROVAL & SUCCESSFUL LOGIN
  // ─────────────────────────────────────────────────────────────────────────────
  test('6. Admin approves user -> status becomes "approved" -> user can log in', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);
    const otp = regRes.body.data.otp;

    // Verify OTP
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: otp });

    // Admin approves user
    const approveRes = await request(app)
      .patch(`/api/v1/admin/users/${userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.status).toBe('success');
    expect(approveRes.body.data.user.status).toBe('approved');
    expect(approveRes.body.data.user).not.toHaveProperty('password_hash');

    // DB verification
    const dbUser = await User.findByPk(userId);
    expect(dbUser.status).toBe('approved');

    // User can now log in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: customer.password,
      });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.status).toBe('success');
    expect(loginRes.body.data).toHaveProperty('accessToken');
    expect(loginRes.body.data.user.status).toBe('approved');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. ADMIN REJECTION & LOGIN BLOCKED
  // ─────────────────────────────────────────────────────────────────────────────
  test('7. Admin rejects user -> status becomes "rejected" -> login returns 403 rejected message', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);
    const otp = regRes.body.data.otp;

    // Verify OTP
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: otp });

    // Admin rejects user with optional reason
    const rejectRes = await request(app)
      .patch(`/api/v1/admin/users/${userId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Invalid identification documents' });

    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.body.status).toBe('success');
    expect(rejectRes.body.data.user.status).toBe('rejected');
    expect(rejectRes.body.data.rejection_reason).toBe('Invalid identification documents');

    // DB verification
    const dbUser = await User.findByPk(userId);
    expect(dbUser.status).toBe('rejected');

    // Login attempt rejected
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: customer.password,
      });

    expect(loginRes.statusCode).toBe(403);
    expect(loginRes.body.status).toBe('error');
    expect(loginRes.body.message).toBe('Your account has been rejected. Contact support.');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. DEALER APPROVAL FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  test('8. Dealer registration creates pending dealer profile and works through approval flow', async () => {
    const dealer = getTestDealer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(dealer);

    expect(regRes.statusCode).toBe(200);
    const userId = regRes.body.data.userId;
    createdUserIds.push(userId);

    const dbUser = await User.findByPk(userId);
    expect(dbUser.role).toBe('dealer');
    expect(dbUser.status).toBe('pending');
    expect(dbUser.is_verified).toBe(false);

    // Verify OTP
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: dealer.email, code: regRes.body.data.otp });

    // Admin approves dealer
    const approveRes = await request(app)
      .patch(`/api/v1/admin/users/${userId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.data.user.status).toBe('approved');

    // Dealer logs in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: dealer.email,
        password: dealer.password,
      });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data.user.role).toBe('dealer');
    expect(loginRes.body.data.user.status).toBe('approved');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. ERROR HANDLING: Non-existent user approval/rejection returns 404
  // ─────────────────────────────────────────────────────────────────────────────
  test('9. Admin approving or rejecting non-existent userId returns 404', async () => {
    const nonExistentId = require('crypto').randomUUID();

    const approveRes = await request(app)
      .patch(`/api/v1/admin/users/${nonExistentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.statusCode).toBe(404);
    expect(approveRes.body.message).toContain('User not found');

    const rejectRes = await request(app)
      .patch(`/api/v1/admin/users/${nonExistentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rejectRes.statusCode).toBe(404);
    expect(rejectRes.body.message).toContain('User not found');
  });
});
