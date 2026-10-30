'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const {
  User,
  VehicleType,
  Brand,
  BrandType,
  Category,
  Car,
} = require('../src/models');

describe('Vehicle Types and Brands - Complete Test Suite', () => {
  let adminToken;
  let customerToken;
  let adminUser;
  let customerUser;
  let sampleCategory;

  const createdTypeIds = [];
  const createdBrandIds = [];
  const createdUserIds = [];

  const setupUser = async (role = 'customer') => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const user = await User.create({
      full_name: `${role.toUpperCase()} User ${randomId}`,
      phone: `9${randomId}555`,
      email: `${role}-${randomId}@testtypes.com`,
      password_hash: '$2a$12$dummyhashtesttypesandbrands',
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

    sampleCategory = await Category.findOne({ where: { slug: 'commercial' } });
    if (!sampleCategory) {
      sampleCategory = await Category.create({
        name: 'Commercial',
        slug: 'commercial',
        order: 4,
        is_active: true,
      });
    }
  });

  afterAll(async () => {
    for (const bId of createdBrandIds) {
      await BrandType.destroy({ where: { brand_id: bId } }).catch(() => {});
      await Brand.destroy({ where: { id: bId } }).catch(() => {});
    }
    for (const tId of createdTypeIds) {
      await BrandType.destroy({ where: { type_id: tId } }).catch(() => {});
      await VehicleType.destroy({ where: { id: tId } }).catch(() => {});
    }
    for (const uId of createdUserIds) {
      await User.destroy({ where: { id: uId } }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. PUBLIC ENDPOINTS
  // =========================================================================
  describe('Public Endpoints (GET /api/v1/types and GET /api/v1/types/:typeId/brands)', () => {
    it('should return list of all active vehicle types', async () => {
      const res = await request(app).get('/api/v1/types');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('name');
      expect(res.body.data[0]).toHaveProperty('slug');
    });

    it('should filter vehicle types by category query parameter (?category=commercial)', async () => {
      const res = await request(app).get('/api/v1/types?category=commercial');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const allCommercial = res.body.data.every(
        (t) => t.category && t.category.slug === 'commercial'
      );
      expect(allCommercial).toBe(true);
    });

    it('should support backward compatible GET /api/v1/car-types', async () => {
      const res = await request(app).get('/api/v1/car-types');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for non-existent vehicle type identifier', async () => {
      const res = await request(app).get('/api/v1/types/non-existent-type-slug-999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. ADMIN VEHICLE TYPES CRUD
  // =========================================================================
  describe('Admin Vehicle Types CRUD (/api/v1/admin/types)', () => {
    let createdTypeId;

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/admin/types')
        .send({ name: 'Unauthorized Type' });
      expect(res.status).toBe(401);
    });

    it('should reject non-admin users with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/types')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Customer Type' });
      expect(res.status).toBe(403);
    });

    it('should validate request body and reject empty name with 400', async () => {
      const res = await request(app)
        .post('/api/v1/admin/types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should create a new vehicle type as Admin (POST)', async () => {
      const uniqueName = `Jest Crane ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: uniqueName,
          category_id: sampleCategory.id,
          order: 50,
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(uniqueName);
      expect(res.body.data.category_id).toBe(sampleCategory.id);
      createdTypeId = res.body.data.id;
      createdTypeIds.push(createdTypeId);
    });

    it('should list all vehicle types including inactive in Admin view (GET)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/types?include_inactive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.some((t) => t.id === createdTypeId);
      expect(found).toBe(true);
    });

    it('should update an existing vehicle type (PUT)', async () => {
      const updatedName = `Jest Crane Updated ${Date.now()}`;
      const res = await request(app)
        .put(`/api/v1/admin/types/${createdTypeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: updatedName,
          order: 60,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updatedName);
      expect(res.body.data.order).toBe(60);
    });

    it('should soft-delete or delete vehicle type cleanly (DELETE)', async () => {
      const tempType = await VehicleType.create({
        name: `Temp Delete ${Date.now()}`,
        slug: `temp-delete-${Date.now()}`,
        order: 99,
        is_active: true,
      });

      const res = await request(app)
        .delete(`/api/v1/admin/types/${tempType.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await VehicleType.findByPk(tempType.id);
      expect(check).toBeNull();
    });
  });

  // =========================================================================
  // 3. ADMIN BRANDS CRUD & TYPE ASSOCIATIONS
  // =========================================================================
  describe('Admin Brands CRUD with Type Associations (/api/v1/admin/brands)', () => {
    let testTypeId1;
    let testTypeId2;
    let createdBrandId;

    beforeAll(async () => {
      const type1 = await VehicleType.create({
        name: `Brand Type A ${Date.now()}`,
        slug: `brand-type-a-${Date.now()}`,
        order: 1,
        is_active: true,
      });
      const type2 = await VehicleType.create({
        name: `Brand Type B ${Date.now()}`,
        slug: `brand-type-b-${Date.now()}`,
        order: 2,
        is_active: true,
      });

      testTypeId1 = type1.id;
      testTypeId2 = type2.id;
      createdTypeIds.push(testTypeId1, testTypeId2);
    });

    it('should reject unauthenticated request for brand creation with 401', async () => {
      const res = await request(app)
        .post('/api/v1/admin/brands')
        .send({ name: 'Unauth Brand' });
      expect(res.status).toBe(401);
    });

    it('should validate brand creation and reject missing name with 400', async () => {
      const res = await request(app)
        .post('/api/v1/admin/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should create a brand linked to multiple vehicle types via type_ids array (POST)', async () => {
      const brandName = `Omni Motors ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: brandName,
          type_ids: [testTypeId1, testTypeId2],
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(brandName);
      expect(res.body.data.types).toBeDefined();
      expect(res.body.data.types.length).toBe(2);

      createdBrandId = res.body.data.id;
      createdBrandIds.push(createdBrandId);

      // Verify DB junction records
      const junctionRows = await BrandType.findAll({ where: { brand_id: createdBrandId } });
      expect(junctionRows.length).toBe(2);
    });

    it('should filter brands by specific vehicle type (GET /api/v1/admin/types/:typeId/brands)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/types/${testTypeId1}/brands`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.some((b) => b.id === createdBrandId);
      expect(found).toBe(true);
    });

    it('should populate dropdown in public endpoint (GET /api/v1/types/:typeId/brands)', async () => {
      const res = await request(app).get(`/api/v1/types/${testTypeId1}/brands`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.some((b) => b.id === createdBrandId);
      expect(found).toBe(true);
    });

    it('should update brand and re-sync linked types (PUT /api/v1/admin/brands/:id)', async () => {
      const updatedName = `Omni Motors Updated ${Date.now()}`;
      const res = await request(app)
        .put(`/api/v1/admin/brands/${createdBrandId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: updatedName,
          type_ids: [testTypeId1], // Removed testTypeId2
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updatedName);
      expect(res.body.data.types.length).toBe(1);
      expect(res.body.data.types[0].id).toBe(testTypeId1);

      // Verify DB junction was synced
      const junctionRows = await BrandType.findAll({ where: { brand_id: createdBrandId } });
      expect(junctionRows.length).toBe(1);
      expect(junctionRows[0].type_id).toBe(testTypeId1);
    });

    it('should delete brand and clean up junction table (DELETE /api/v1/admin/brands/:id)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/brands/${createdBrandId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkBrand = await Brand.findByPk(createdBrandId);
      expect(checkBrand).toBeNull();

      const checkJunction = await BrandType.findAll({ where: { brand_id: createdBrandId } });
      expect(checkJunction.length).toBe(0);
    });
  });
});
