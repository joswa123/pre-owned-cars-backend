// tests/auth.test.js
const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Auth Flow Integration Tests', () => {
  // Standard test user data
  const testCustomer = {
    full_name: 'John Doe',
    phone: '9876543210',
    email: 'johndoe@example.com',
    password: 'Password@123',
    role: 'customer',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    city: 'Gandhipuram',
  };

  let otpCode;

  // -------- 1. Registration (Happy Path) --------
  test('POST /api/v1/auth/register - should register a new customer', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testCustomer);
  console.log('📦 Registration Response:', JSON.stringify(res.body, null, 2)); // <-- Add this
    expect(res.statusCode).toBe(200);          // your controller returns 200 for success
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('userId');
    expect(res.body.data.email).toBe(testCustomer.email);

    // Your controller returns OTP in response (in test/dev environment)
    expect(res.body.data).toHaveProperty('otp');
    otpCode = res.body.data.otp;
  });

  // -------- 2. Verification (Happy Path) --------
  test('POST /api/v1/auth/verify - should verify OTP and return tokens', async () => {
    // First register to get fresh OTP
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testCustomer);
    const code = regRes.body.data.otp;

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify')
      .send({
        email: testCustomer.email,
        code: code,
      });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.status).toBe('success');
    expect(verifyRes.body.data).toHaveProperty('accessToken');

    // Double-check DB: user should be verified
    const user = await User.findOne({ where: { email: testCustomer.email } });
    expect(user.is_verified).toBe(true);
  });

  // -------- 3. Login (Happy Path) --------
  test('POST /api/v1/auth/login - should authenticate verified user', async () => {
    // Setup: register + verify
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testCustomer);
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: testCustomer.email, code: regRes.body.data.otp });

    // Actual login
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testCustomer.email,
        password: testCustomer.password,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user.email).toBe(testCustomer.email);
  });

  // -------- 4. Sad Path: Duplicate Email --------
  test('POST /api/v1/auth/register - should reject duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(testCustomer);

    // Second registration with same email
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testCustomer);

    expect(res.statusCode).toBe(400); // or 409 – check your error handler
    expect(res.body.status).toBe('error');
  });

  // -------- 5. Sad Path: Wrong Password --------
  test('POST /api/v1/auth/login - should reject incorrect password', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testCustomer);
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: testCustomer.email, code: regRes.body.data.otp });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testCustomer.email,
        password: 'WrongPassword123!',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('error');
  });
});