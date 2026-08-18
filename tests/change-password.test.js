const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Change Password Integration Tests', () => {
  const getTestCustomer = () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    return {
      full_name: `John ChangePass ${randomId}`,
      phone: `9${randomId}002`,
      email: `changepass-${randomId}@example.com`,
      password: 'Password@123',
      role: 'customer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };
  };

  let customer;
  let accessToken;

  beforeEach(async () => {
    customer = getTestCustomer();
    // Register the user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(customer);
    const code = regRes.body.data.otp;

    // Verify OTP to get initial tokens and make user verified
    const verifyRes = await request(app)
      .post('/api/v1/auth/verify')
      .send({
        email: customer.email,
        code: code,
      });

    accessToken = verifyRes.body.data.accessToken;
  });

  // -------- 1. Happy Path: Change Password Successfully --------
  test('POST /api/v1/auth/change-password - should change password and allow login with new password', async () => {
    const newPassword = 'NewSecurePassword123!';

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: customer.password,
        newPassword: newPassword,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Password updated successfully');

    // Verify login with OLD password fails
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: customer.password,
      });
    expect(oldLoginRes.statusCode).toBe(401);

    // Verify login with NEW password succeeds
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: customer.email,
        password: newPassword,
      });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.body.status).toBe('success');
  });

  // -------- 2. Sad Path: Invalid Current Password --------
  test('POST /api/v1/auth/change-password - should reject if current password is wrong', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongCurrentPassword123!',
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Invalid current password');
  });

  // -------- 3. Sad Path: Missing Current Password --------
  test('POST /api/v1/auth/change-password - should reject if current password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('"currentPassword" is required');
  });

  // -------- 4. Sad Path: Missing New Password --------
  test('POST /api/v1/auth/change-password - should reject if new password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: customer.password,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('"newPassword" is required');
  });

  // -------- 5. Sad Path: New Password Too Short --------
  test('POST /api/v1/auth/change-password - should reject if new password is less than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: customer.password,
        newPassword: 'short',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('"newPassword" length must be at least 8 characters long');
  });

  // -------- 6. Sad Path: Unauthenticated request --------
  test('POST /api/v1/auth/change-password - should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({
        currentPassword: customer.password,
        newPassword: 'NewSecurePassword123!',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('You are not logged in. Please log in.');
  });
});
