const request = require('supertest');
const app = require('../src/app');
const { Banner, User } = require('../src/models');
const jwt = require('jsonwebtoken');
const sequelize = require('../src/config/database');

let adminToken;
let banner1Id, banner2Id;

beforeAll(async () => {
  await Banner.sync({ force: true });
  await User.destroy({ where: { id: '11111111-1111-1111-1111-111111111111' } });

  const adminId = require('crypto').randomUUID();
  // Create an admin user
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

  // Seed some initial banners for testing
  const b1 = await Banner.create({ image_url: 'http://test.com/b1.jpg', order: 0, is_active: true });
  const b2 = await Banner.create({ image_url: 'http://test.com/b2.jpg', order: 1, is_active: false });
  
  banner1Id = b1.id;
  banner2Id = b2.id;
});

afterAll(async () => {
  await sequelize.close();
});

describe('Banner Management APIs', () => {
  describe('GET /api/v1/banners (Public)', () => {
    it('Should fetch only active banners sorted by order', async () => {
      const res = await request(app).get('/api/v1/banners');
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // Should only get active banner
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(banner1Id);
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
      expect(res.body.data.length).toBe(2);
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

    // We can't easily test Multer+Cloudinary in supertest without a mock or local storage,
    // but we can test validation failure for mimetype by sending a text file if we want,
    // or we just trust the middleware logic since NODE_ENV=test will use local storage.
    it('Should create a banner and auto-assign order', async () => {
      const res = await request(app)
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'New Banner')
        // Use a valid 1x1 PNG buffer so Cloudinary or local storage doesn't complain about format
        .attach('image', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'), { filename: 'test.png', contentType: 'image/png' });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.banner.title).toBe('New Banner');
      expect(res.body.data.banner.order).toBe(2); // Since highest order was 1
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
            { id: banner1Id, order: 10 },
            { id: banner2Id, order: 5 }
          ]
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toMatch(/reordered successfully/);

      // Verify DB
      const b1 = await Banner.findByPk(banner1Id);
      const b2 = await Banner.findByPk(banner2Id);
      expect(b1.order).toBe(10);
      expect(b2.order).toBe(5);
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
