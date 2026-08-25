const request = require('supertest');
const app = require('../src/app');
const { Banner, User } = require('../src/models');
const jwt = require('jsonwebtoken');
const redisClient = require('../src/config/redis');

let adminToken;
let adminId;
let banner1Id, banner2Id;
let createdBannerIds = [];

beforeAll(async () => {
  // Clear banner redis cache
  try {
    if (redisClient.isOpen) {
      await redisClient.del('public:banners');
    }
  } catch (e) {}

  adminId = require('crypto').randomUUID();
  // Create an admin user for testing
  const admin = await User.create({
    id: adminId,
    full_name: 'Admin User',
    phone: '999' + Math.floor(1000000 + Math.random() * 9000000),
    phone_number: '999' + Math.floor(1000000 + Math.random() * 9000000),
    password_hash: 'hashedpassword',
    role: 'admin',
    is_active: true,
  });

  adminToken = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

  // Seed test banners
  const b1 = await Banner.create({ image_url: 'http://test.com/b1.jpg', title: 'Test Active Banner', order: 998, is_active: true });
  const b2 = await Banner.create({ image_url: 'http://test.com/b2.jpg', title: 'Test Inactive Banner', order: 999, is_active: false });
  
  banner1Id = b1.id;
  banner2Id = b2.id;
  createdBannerIds.push(banner1Id, banner2Id);

  // Invalidate cache so new banners are included
  try {
    if (redisClient.isOpen) {
      await redisClient.del('public:banners');
    }
  } catch (e) {}
});

afterAll(async () => {
  try {
    if (createdBannerIds.length > 0) {
      await Banner.destroy({ where: { id: createdBannerIds } });
    }
    if (adminId) {
      await User.destroy({ where: { id: adminId } });
    }
    if (redisClient.isOpen) {
      await redisClient.del('public:banners');
    }
  } catch (e) {}
});

describe('Banner Management APIs', () => {
  describe('GET /api/v1/banners (Public)', () => {
    it('Should fetch active banners sorted by order', async () => {
      const res = await request(app).get('/api/v1/banners');
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      
      // All returned banners should be active
      res.body.data.forEach(b => {
        expect(b.is_active).toBe(true);
      });
      
      const activeIds = res.body.data.map(b => b.id);
      expect(activeIds).toContain(banner1Id);
      expect(activeIds).not.toContain(banner2Id);
    });
  });

  describe('GET /api/v1/admin/banners (Admin)', () => {
    it('Should fail without admin token', async () => {
      const res = await request(app).get('/api/v1/admin/banners');
      expect(res.statusCode).toEqual(401);
    });

    it('Should fetch all banners (active and inactive)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toEqual(200);
      const allIds = res.body.data.map(b => b.id);
      expect(allIds).toContain(banner1Id);
      expect(allIds).toContain(banner2Id);
    });
  });

  describe('POST /api/v1/admin/banners', () => {
    it('Should require an image file', async () => {
      const res = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test Banner');

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/Image file is required/);
    });

    it('Should create a banner and auto-assign order', async () => {
      const res = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'New Test Banner')
        .attach('image', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'), { filename: 'test.png', contentType: 'image/png' });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.banner.title).toBe('New Test Banner');
      if (res.body.data.banner.id) {
        createdBannerIds.push(res.body.data.banner.id);
      }
    });
  });

  describe('PUT /api/v1/admin/banners/:id', () => {
    it('Should update banner fields', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/banners/${banner2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Title', is_active: true });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.banner.title).toBe('Updated Title');
      expect(res.body.data.banner.is_active).toBe(true);
    });
  });

  describe('POST /api/v1/admin/banners/reorder', () => {
    it('Should reorder banners successfully', async () => {
      const res = await request(app)
        .post('/api/v1/admin/banners/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orders: [
            { id: banner1Id, order: 1000 },
            { id: banner2Id, order: 1001 }
          ]
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/reordered successfully/);

      const b1 = await Banner.findByPk(banner1Id);
      const b2 = await Banner.findByPk(banner2Id);
      expect(b1.order).toBe(1000);
      expect(b2.order).toBe(1001);
    });
  });

  describe('DELETE /api/v1/admin/banners/:id', () => {
    it('Should delete a banner', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/banners/${banner1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(204);

      const check = await Banner.findByPk(banner1Id);
      expect(check).toBeNull();
    });
  });
});
