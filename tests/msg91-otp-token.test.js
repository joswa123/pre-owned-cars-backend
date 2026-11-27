const request = require('supertest');
const app = require('../src/app');
const { User, CustomerProfile, RefreshToken } = require('../src/models');
const bcrypt = require('bcryptjs');

describe('MSG91 OTP Access Token Verification API', () => {
  const originalFetch = global.fetch;
  const createdUserIds = [];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    if (createdUserIds.length > 0) {
      await CustomerProfile.destroy({ where: { user_id: createdUserIds } }).catch(() => {});
      await RefreshToken.destroy({ where: { user_id: createdUserIds } }).catch(() => {});
      await User.destroy({ where: { id: createdUserIds }, force: true }).catch(() => {});
    }
  });

  describe('POST /api/auth/verify-otp-token & /api/v1/auth/verify-otp-token', () => {
    it('successfully registers and logs in a NEW user via MSG91 token (with 91 country prefix)', async () => {
      const phoneDigits = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const msg91Phone = `91${phoneDigits}`;

      jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
        expect(url).toBe('https://control.msg91.com/api/v5/widget/verifyAccessToken');
        expect(options.method).toBe('POST');
        expect(options.headers.authkey).toBeDefined();

        const body = JSON.parse(options.body);
        expect(body['access-token']).toBe('mock-valid-msg91-jwt-token-1');

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            type: 'success',
            message: msg91Phone,
          }),
        });
      });

      const res = await request(app)
        .post('/api/auth/verify-otp-token')
        .send({
          accessToken: 'mock-valid-msg91-jwt-token-1',
          name: 'New MSG91 Customer',
          device_token: 'device-fcm-token-123',
          device_type: 'android',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.isNewUser).toBe(true);
      expect(res.body.data.user.phone).toBe(phoneDigits);
      expect(res.body.data.user.full_name).toBe('New MSG91 Customer');
      expect(res.body.data.user.is_verified).toBe(true);

      createdUserIds.push(res.body.data.user.id);

      // Verify in DB
      const userInDb = await User.findByPk(res.body.data.user.id);
      expect(userInDb).not.toBeNull();
      expect(userInDb.phone).toBe(phoneDigits);
      expect(userInDb.device_token).toBe('device-fcm-token-123');
      expect(userInDb.device_type).toBe('android');
    });

    it('successfully logs in an EXISTING user via /api/v1/auth/verify-otp-token', async () => {
      const existingPhone = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const existingUser = await User.create({
        full_name: 'Existing Customer',
        phone: existingPhone,
        password_hash: await bcrypt.hash('secret123', 10),
        role: 'customer',
        is_verified: false,
        status: 'approved',
      });
      createdUserIds.push(existingUser.id);

      jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            type: 'success',
            message: existingPhone, // without country code prefix
          }),
        });
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-otp-token')
        .send({
          accessToken: 'mock-valid-msg91-jwt-token-2',
          device_token: 'new-device-token-456',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.isNewUser).toBe(false);
      expect(res.body.data.user.id).toBe(existingUser.id);
      expect(res.body.data.user.phone).toBe(existingPhone);
      expect(res.body.data.user.is_verified).toBe(true);

      // Verify DB was updated
      await existingUser.reload();
      expect(existingUser.is_verified).toBe(true);
      expect(existingUser.device_token).toBe('new-device-token-456');
    });

    it('accepts snake_case access_token parameter', async () => {
      const phoneDigits = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      jest.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            type: 'success',
            message: `+91${phoneDigits}`,
          }),
        });
      });

      const res = await request(app)
        .post('/api/auth/verify-otp-token')
        .send({
          access_token: 'mock-valid-token-snake',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.phone).toBe(phoneDigits);
      createdUserIds.push(res.body.data.user.id);
    });

    it('returns 401 when MSG91 returns HTTP 200 with error payload (type: "error")', async () => {
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            type: 'error',
            code: '201',
            message: 'Access Token has expired or is invalid.',
          }),
        });
      });

      const res = await request(app)
        .post('/api/auth/verify-otp-token')
        .send({
          accessToken: 'expired-or-invalid-token',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Token has expired or is invalid');
    });

    it('returns 401 when MSG91 returns HTTP error (e.g. 401 Unauthorized)', async () => {
      jest.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({
            type: 'error',
            message: 'IP not whitelisted or Invalid Auth Key',
          }),
        });
      });

      const res = await request(app)
        .post('/api/auth/verify-otp-token')
        .send({
          accessToken: 'some-token',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('IP not whitelisted or Invalid Auth Key');
    });

    it('returns 400 Bad Request when accessToken is missing', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
