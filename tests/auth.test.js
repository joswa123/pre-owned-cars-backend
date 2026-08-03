// tests/auth.test.js
const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Auth Flow Integration Tests', () => {
  const getTestCustomer = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `John Doe ${randomId}`,
      phone: `9${randomId}01`,
      email: `johndoe-${randomId}@example.com`,
      password: 'Password@123',
      role: 'customer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };
  };

  // -------- 1. Registration (Happy Path) --------
  test('POST /api/v1/auth/register - should register a new customer', async () => {
    const customer = getTestCustomer();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('userId');
    expect(res.body.data.email).toBe(customer.email);
    expect(res.body.data).toHaveProperty('otp');
  });

  // -------- 2. Verification (Happy Path) --------
  test('POST /api/v1/auth/verify - should verify OTP and return tokens', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);
    const code = regRes.body.data.otp;

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify')
      .send({
        email: customer.email,
        code: code,
      });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.status).toBe('success');
    expect(verifyRes.body.data).toHaveProperty('accessToken');

    const user = await User.findOne({ where: { email: customer.email } });
    expect(user.is_verified).toBe(true);
  });

  // -------- 3. Login (Happy Path) --------
  test('POST /api/v1/auth/login - should authenticate verified user', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: regRes.body.data.otp });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: customer.password,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user.email).toBe(customer.email);
  });

  // -------- 4. Sad Path: Duplicate Email --------
  test('POST /api/v1/auth/register - should reject duplicate email', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app).post('/api/v1/auth/register').send(customer);
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: regRes.body.data.otp });

    // Second registration with same verified email
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('error');
  });

  // -------- 5. Sad Path: Wrong Password --------
  test('POST /api/v1/auth/login - should reject incorrect password', async () => {
    const customer = getTestCustomer();
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);
    await request(app)
      .post('/api/v1/auth/verify')
      .send({ email: customer.email, code: regRes.body.data.otp });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: 'WrongPassword123!',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('error');
  });
});