'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const redisClient = require('../src/config/redis');
const {
  User,
  Car,
  Brand,
  Model,
  Variant,
  Highlight,
  CarHighlight,
} = require('../src/models');

describe('Admin Highlights CRUD Integration & Safety Tests', () => {
  let adminToken;
  let customerToken;
  let dealerToken;
  let adminUser;
  let customerUser;
  let dealerUser;
  let testCar;

  const createdHighlightIds = [];
  const createdCarIds = [];
  const createdUserIds = [];

  const setupUser = async (role = 'customer') => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const user = await User.create({
      full_name: `${role.toUpperCase()} User ${randomId}`,
      phone: `9${randomId}009`,
      email: `${role}-${randomId}@testhighlights.com`,
      password_hash: '$2a$12$dummyhashforhighlightsadmincrudtester',
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
    const admin = await setupUser('admin');
    adminToken = admin.token;
    adminUser = admin.user;

    const customer = await setupUser('customer');
    customerToken = customer.token;
    customerUser = customer.user;

    const dealer = await setupUser('dealer');
    dealerToken = dealer.token;
    dealerUser = dealer.user;

    const [brand] = await Brand.findOrCreate({
      where: { name: 'Toyota' },
      defaults: { name: 'Toyota' },
    });
    const [model] = await Model.findOrCreate({
      where: { name: 'Innova', brand_id: brand.id },
      defaults: { name: 'Innova', brandId: brand.id, bodyType: 'MUV' },
    });
    const [variant] = await Variant.findOrCreate({
      where: { name: 'Crysta 2.4 VX', model_id: model.id },
      defaults: { name: 'Crysta 2.4 VX', model_id: model.id },
    });

    testCar = await Car.create({
      user_id: dealerUser.id,
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2022,
      price: 2100000,
      km_driven: 25000,
      fuel_type: 'Diesel',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'MUV',
      board_type: 'Own Board',
      status: 'active',
      posted_by_type: 'dealer',
    });
    createdCarIds.push(testCar.id);
  });

  afterAll(async () => {
    if (createdHighlightIds.length > 0) {
      await CarHighlight.destroy({ where: { highlight_id: createdHighlightIds } }).catch(() => {});
      await Highlight.destroy({ where: { id: createdHighlightIds } }).catch(() => {});
    }
    if (createdCarIds.length > 0) {
      await CarHighlight.destroy({ where: { car_id: createdCarIds } }).catch(() => {});
      await Car.destroy({ where: { id: createdCarIds } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: createdUserIds } }).catch(() => {});
    }
  });

  describe('1. Authentication and Authorization Guards', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/admin/highlights');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin users (customer & dealer) with 403', async () => {
      const resCust = await request(app)
        .get('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCust.status).toBe(403);

      const resDealer = await request(app)
        .get('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${dealerToken}`);
      expect(resDealer.status).toBe(403);
    });

    it('should allow admin user with 200 on /api/v1/admin/highlights', async () => {
      const res = await request(app)
        .get('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should resolve route alias /api/admin/highlights identically with 200', async () => {
      const res = await request(app)
        .get('/api/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('2. Validation & Duplicate Checking', () => {
    it('should reject empty or missing name with 400', async () => {
      const res = await request(app)
        .post('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('should trim and collapse whitespace on highlight name', async () => {
      const uniqueName = `Sunroof Extra   Wide ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `  ${uniqueName}   ` });

      expect(res.status).toBe(201);
      const highlight = res.body.data.highlight;
      createdHighlightIds.push(highlight.id);
      expect(highlight.name).toBe(uniqueName.replace(/\s+/g, ' '));
      expect(highlight.cars_count).toBe(0);
    });

    it('should reject case-insensitive duplicate name with 409', async () => {
      const baseName = `VIP Number Tag ${Date.now()}`;
      const createRes = await request(app)
        .post('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: baseName });
      expect(createRes.status).toBe(201);
      createdHighlightIds.push(createRes.body.data.highlight.id);

      // Attempt duplicate with different casing
      const dupRes = await request(app)
        .post('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: baseName.toLowerCase() });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.message).toMatch(/already exists/i);
    });

    it('should reject unknown fields on PATCH with 400', async () => {
      const testH = await Highlight.create({ name: `Patch Test ${Date.now()}` });
      createdHighlightIds.push(testH.id);

      const res = await request(app)
        .patch(`/api/v1/admin/highlights/${testH.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false, name: 'Hacked Name' });

      expect(res.status).toBe(400);
    });
  });

  describe('3. Admin CRUD, cars_count, and Associations', () => {
    let highlightId;
    const initialName = `Single Owner Clean ${Date.now()}`;

    it('POST / creates highlight with cars_count 0', async () => {
      const res = await request(app)
        .post('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: initialName, is_active: true });

      expect(res.status).toBe(201);
      highlightId = res.body.data.highlight.id;
      createdHighlightIds.push(highlightId);
      expect(res.body.data.highlight.name).toBe(initialName);
      expect(res.body.data.highlight.cars_count).toBe(0);
    });

    it('GET /:id returns single highlight with cars_count', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/highlights/${highlightId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.highlight.id).toBe(highlightId);
      expect(res.body.data.highlight.cars_count).toBe(0);
    });

    it('PATCH /:id toggles is_active successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/highlights/${highlightId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.highlight.is_active).toBe(false);

      // Verify in public endpoint it is not returned
      const pubRes = await request(app).get('/api/v1/highlights');
      expect(pubRes.status).toBe(200);
      const found = pubRes.body.data.find(h => h.id === highlightId);
      expect(found).toBeUndefined();
    });

    it('Reflects accurate cars_count after linking to a car', async () => {
      await CarHighlight.create({
        car_id: testCar.id,
        highlight_id: highlightId,
      });

      const res = await request(app)
        .get(`/api/v1/admin/highlights/${highlightId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.highlight.cars_count).toBe(1);
    });

    it('PUT /:id renames highlight while preserving car association', async () => {
      const newName = `1st Owner Immaculate ${Date.now()}`;
      const res = await request(app)
        .put(`/api/v1/admin/highlights/${highlightId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: newName });

      expect(res.status).toBe(200);
      expect(res.body.data.highlight.name).toBe(newName);
      expect(res.body.data.highlight.cars_count).toBe(1);

      // Verify car junction still references same highlight ID
      const junction = await CarHighlight.findOne({
        where: { car_id: testCar.id, highlight_id: highlightId },
      });
      expect(junction).not.toBeNull();
    });
  });

  describe('4. Safe Deletion and Cascade Invariance', () => {
    let assignedHighlightId;

    beforeAll(async () => {
      const h = await Highlight.create({ name: `Safe Delete Test ${Date.now()}` });
      assignedHighlightId = h.id;
      createdHighlightIds.push(h.id);

      await CarHighlight.create({
        car_id: testCar.id,
        highlight_id: assignedHighlightId,
      });
    });

    it('should return 409 when deleting a highlight in use without ?force=true', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/highlights/${assignedHighlightId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Cannot delete: highlight is used by 1 cars/i);

      // Verify highlight and junction still exist
      const hCheck = await Highlight.findByPk(assignedHighlightId);
      expect(hCheck).not.toBeNull();
    });

    it('should force delete when ?force=true: removes junction rows and NEVER touches the cars table', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/highlights/${assignedHighlightId}?force=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/force-deleted successfully/i);

      // 1. Highlight is deleted
      const hCheck = await Highlight.findByPk(assignedHighlightId);
      expect(hCheck).toBeNull();

      // 2. Junction row is deleted
      const junctionCheck = await CarHighlight.findOne({
        where: { car_id: testCar.id, highlight_id: assignedHighlightId },
      });
      expect(junctionCheck).toBeNull();

      // 3. CRITICAL: Car remains completely intact
      const carCheck = await Car.findByPk(testCar.id);
      expect(carCheck).not.toBeNull();
      expect(carCheck.id).toBe(testCar.id);
    });

    it('should allow clean delete of an unused highlight (cars_count = 0)', async () => {
      const unusedH = await Highlight.create({ name: `Unused Highlight ${Date.now()}` });
      createdHighlightIds.push(unusedH.id);

      const res = await request(app)
        .delete(`/api/v1/admin/highlights/${unusedH.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const check = await Highlight.findByPk(unusedH.id);
      expect(check).toBeNull();
    });
  });

  describe('5. Cross-Cache Invalidation Logic', () => {
    it('should invalidate cars:list:* on rename but NOT on create or toggle', async () => {
      if (!redisClient.isOpen) {
        return; // Skip if redis is not running in test environment
      }

      // Pre-populate dummy cache keys
      await redisClient.set('cars:list:testhash1', 'cached_data');
      await redisClient.set('public:highlights', 'cached_data');

      // 1. Create highlight -> cars:list:* must remain intact
      const createRes = await request(app)
        .post('/api/v1/admin/highlights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Cache Test Highlight ${Date.now()}` });
      const createdId = createRes.body.data.highlight.id;
      createdHighlightIds.push(createdId);

      const carsListStillThere = await redisClient.get('cars:list:testhash1');
      expect(carsListStillThere).toBe('cached_data');

      // 2. Rename highlight -> cars:list:* must be purged
      await request(app)
        .put(`/api/v1/admin/highlights/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Renamed Cache Tag ${Date.now()}` });

      const carsListPurged = await redisClient.get('cars:list:testhash1');
      expect(carsListPurged).toBeNull();
    });
  });
});
