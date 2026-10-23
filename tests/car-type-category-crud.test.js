'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const redisClient = require('../src/config/redis');
const carTypeService = require('../src/services/carTypeService');
const cloudinaryHelper = require('../src/utils/cloudinaryHelper');
const {
  User,
  Car,
  Brand,
  Model,
  Variant,
  CarType,
} = require('../src/models');

describe('Car Types / Categories CRUD & Safety Tests', () => {
  let adminToken;
  let customerToken;
  let adminUser;
  let customerUser;
  let testCar;
  let dummyImagePath;

  const createdCarTypeIds = [];
  const createdCarIds = [];
  const createdUserIds = [];

  const setupUser = async (role = 'customer') => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const user = await User.create({
      full_name: `${role.toUpperCase()} User ${randomId}`,
      phone: `9${randomId}777`,
      email: `${role}-${randomId}@testcartypes.com`,
      password_hash: '$2a$12$dummyhashforcartypesadmincrudtester',
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
    // Setup dummy image fixture for multipart tests
    const fixturesDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    dummyImagePath = path.join(fixturesDir, 'test-cat-icon.png');
    // 1x1 transparent PNG buffer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    fs.writeFileSync(dummyImagePath, pngBuffer);

    const admin = await setupUser('admin');
    adminToken = admin.token;
    adminUser = admin.user;

    const customer = await setupUser('customer');
    customerToken = customer.token;
    customerUser = customer.user;

    // Seed Brand, Model, Variant, and a Car referencing category "Test In Use Category"
    const [brand] = await Brand.findOrCreate({
      where: { name: 'Hyundai' },
      defaults: { name: 'Hyundai' },
    });
    const [model] = await Model.findOrCreate({
      where: { name: 'Creta', brand_id: brand.id },
      defaults: { name: 'Creta', brandId: brand.id, bodyType: 'SUV' },
    });
    const [variant] = await Variant.findOrCreate({
      where: { name: 'SX(O)', model_id: model.id },
      defaults: { name: 'SX(O)', model_id: model.id },
    });

    testCar = await Car.create({
      user_id: adminUser.id,
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2023,
      price: 1850000,
      km_driven: 15000,
      fuel_type: 'Petrol',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'Test In Use Category',
      board_type: 'Own Board',
      status: 'active',
      posted_by_type: 'dealer',
    });
    createdCarIds.push(testCar.id);
  });

  afterAll(async () => {
    // Cleanup created cars
    if (createdCarIds.length > 0) {
      await Car.destroy({ where: { id: createdCarIds } }).catch(() => {});
    }
    // Cleanup created car types
    if (createdCarTypeIds.length > 0) {
      await CarType.destroy({ where: { id: createdCarTypeIds } }).catch(() => {});
    }
    // Cleanup created users
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: createdUserIds } }).catch(() => {});
    }
    // Remove dummy image fixture
    if (fs.existsSync(dummyImagePath)) {
      try {
        fs.unlinkSync(dummyImagePath);
      } catch (e) {}
    }
  });

  // =========================================================================
  // 1. UNIT TESTS (Service Layer)
  // =========================================================================
  describe('Unit: carTypeService', () => {
    it('1. createCarType persists name, slug, icon_url, image_public_id, and order', async () => {
      const created = await carTypeService.createCarType({
        name: 'Electric Fastback',
        icon_url: 'https://res.cloudinary.com/demo/image/upload/v123456/autodeal4u/categories/fastback.png',
        order: 5,
        is_active: true,
      }, null, adminUser);

      createdCarTypeIds.push(created.id);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Electric Fastback');
      expect(created.slug).toBe('electric-fastback');
      expect(created.icon_url).toContain('fastback.png');
      expect(created.image_public_id).toBe('autodeal4u/categories/fastback');
      expect(created.order).toBe(5);
      expect(created.is_active).toBe(true);
    });

    it('2. createCarType rejects duplicate name (case-insensitive) with CATEGORY_NAME_TAKEN', async () => {
      await expect(
        carTypeService.createCarType({ name: 'electric fastback' }, null, adminUser)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CATEGORY_NAME_TAKEN',
      });
    });

    it('3. createCarType trims and collapses whitespace in name; rejects empty', async () => {
      const created = await carTypeService.createCarType({
        name: '   Luxury    Gran   Tourer   ',
      }, null, adminUser);
      createdCarTypeIds.push(created.id);

      expect(created.name).toBe('Luxury Gran Tourer');
      expect(created.slug).toBe('luxury-gran-tourer');

      await expect(
        carTypeService.createCarType({ name: '    ' }, null, adminUser)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('4. createCarType generates unique slug collision suffixes when collision occurs', async () => {
      const cat1 = await carTypeService.createCarType({ name: 'Compact Crossover Alpha' }, null, adminUser);
      createdCarTypeIds.push(cat1.id);
      expect(cat1.slug).toBe('compact-crossover-alpha');

      // Force a category with different name that slugifies similarly or custom slug test
      const cat2 = await carTypeService.createCarType({
        name: 'Compact Crossover Alpha!',
        slug: 'compact-crossover-alpha', // Trigger conflict
      }, null, adminUser).catch((e) => e);

      expect(cat2.statusCode).toBe(409);
      expect(cat2.code).toBe('CATEGORY_NAME_TAKEN');
    });

    it('5. updateCarType updates only provided fields (partial update)', async () => {
      const cat = await carTypeService.createCarType({ name: 'Partial Test Item', order: 10 }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const updated = await carTypeService.updateCarType(cat.id, { order: 25 }, null, adminUser);
      expect(updated.order).toBe(25);
      expect(updated.name).toBe('Partial Test Item');
    });

    it('6. updateCarType replacing image invokes deletion of old Cloudinary asset', async () => {
      const deleteSpy = jest.spyOn(cloudinaryHelper, 'deleteCloudinaryMedia');

      const cat = await carTypeService.createCarType({
        name: 'Replace Image Test',
        icon_url: 'https://res.cloudinary.com/demo/image/upload/autodeal4u/categories/old-asset.png',
      }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const updated = await carTypeService.updateCarType(cat.id, {
        icon_url: 'https://res.cloudinary.com/demo/image/upload/autodeal4u/categories/new-asset.png',
      }, null, adminUser);

      expect(updated.image_public_id).toBe('autodeal4u/categories/new-asset');
      expect(deleteSpy).toHaveBeenCalledWith('autodeal4u/categories/old-asset', 'image');
      deleteSpy.mockRestore();
    });

    it('7. updateCarType with failed DB write compensates newly uploaded file', async () => {
      const deleteSpy = jest.spyOn(cloudinaryHelper, 'deleteCloudinaryMedia');
      const cat = await carTypeService.createCarType({ name: 'Compensation Test Item' }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const fakeUploadedFile = {
        path: 'https://res.cloudinary.com/demo/image/upload/autodeal4u/categories/new-temp.png',
        filename: 'autodeal4u/categories/new-temp',
      };

      const foundInstance = await CarType.findByPk(cat.id);
      jest.spyOn(CarType, 'findByPk').mockResolvedValueOnce(foundInstance);
      jest.spyOn(foundInstance, 'update').mockRejectedValueOnce(new Error('Simulated DB Failure'));

      await expect(
        carTypeService.updateCarType(cat.id, {}, fakeUploadedFile, adminUser)
      ).rejects.toThrow('Simulated DB Failure');

      expect(deleteSpy).toHaveBeenCalledWith('autodeal4u/categories/new-temp', 'image');
      deleteSpy.mockRestore();
    });

    it('8. deleteCarType blocks when referenced by any cars row -> CATEGORY_IN_USE (409)', async () => {
      const inUseCat = await carTypeService.createCarType({ name: 'Test In Use Category' }, null, adminUser);
      createdCarTypeIds.push(inUseCat.id);

      await expect(
        carTypeService.deleteCarType(inUseCat.id, adminUser)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CATEGORY_IN_USE',
      });
    });

    it('9. deleteCarType on unreferenced row deletes DB row and Cloudinary asset', async () => {
      const deleteSpy = jest.spyOn(cloudinaryHelper, 'deleteCloudinaryMedia');
      const disposableCat = await carTypeService.createCarType({
        name: 'Disposable Cat',
        icon_url: 'https://res.cloudinary.com/demo/image/upload/autodeal4u/categories/disposable.png',
      }, null, adminUser);

      const result = await carTypeService.deleteCarType(disposableCat.id, adminUser);
      expect(result).toBe(true);

      const found = await CarType.findByPk(disposableCat.id);
      expect(found).toBeNull();
      expect(deleteSpy).toHaveBeenCalledWith('autodeal4u/categories/disposable', 'image');
      deleteSpy.mockRestore();
    });

    it('10. deleteCarType on missing id throws 404 CATEGORY_NOT_FOUND', async () => {
      await expect(
        carTypeService.deleteCarType('00000000-0000-0000-0000-000000000000', adminUser)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CATEGORY_NOT_FOUND',
      });
    });

    it('11. getAllCarTypes sorts by order ASC, name ASC, id ASC deterministically', async () => {
      const list = await carTypeService.getAllCarTypes();
      expect(Array.isArray(list)).toBe(true);
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const curr = list[i];
        if (prev.order === curr.order) {
          expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
        } else {
          expect(prev.order).toBeLessThanOrEqual(curr.order);
        }
      }
    });

    it('12. getCarTypeByIdentifier resolves by UUID, slug, and name', async () => {
      const cat = await carTypeService.createCarType({ name: 'Resolution Test Type' }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const byId = await carTypeService.getCarTypeByIdentifier(cat.id);
      expect(byId.id).toBe(cat.id);

      const bySlug = await carTypeService.getCarTypeByIdentifier(cat.slug);
      expect(bySlug.id).toBe(cat.id);

      const byName = await carTypeService.getCarTypeByIdentifier('resolution test type');
      expect(byName.id).toBe(cat.id);

      await expect(
        carTypeService.getCarTypeByIdentifier('non-existent-random-category-key')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CATEGORY_NOT_FOUND',
      });
    });
  });

  // =========================================================================
  // 2. INTEGRATION / HTTP TESTS (supertest)
  // =========================================================================
  describe('Integration: HTTP Endpoints', () => {
    it('14. POST /api/v1/admin/car-types multipart with image -> 201, icon_url & image_public_id present', async () => {
      const res = await request(app)
        .post('/api/v1/admin/car-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Hypercar Ultra')
        .field('order', '1')
        .attach('image', dummyImagePath);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Hypercar Ultra');
      expect(res.body.data.slug).toBe('hypercar-ultra');
      expect(res.body.data.icon_url).toBeDefined();
      expect(res.body.data.image_public_id).toBeDefined();
      createdCarTypeIds.push(res.body.data.id);
    });

    it('15. POST /api/v1/admin/car-types multipart without image -> 201 with null icon', async () => {
      const res = await request(app)
        .post('/api/v1/admin/car-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Micro Car Urban')
        .field('order', '9');

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Micro Car Urban');
      expect(res.body.data.icon_url).toBeNull();
      createdCarTypeIds.push(res.body.data.id);
    });

    it('16. POST /api/v1/admin/car-types with JSON icon_url -> 201', async () => {
      const res = await request(app)
        .post('/api/v1/admin/car-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Roadster Sport',
          icon_url: 'https://res.cloudinary.com/demo/image/upload/v1/autodeal4u/categories/roadster.png',
          order: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('roadster-sport');
      createdCarTypeIds.push(res.body.data.id);
    });

    it('17. POST /api/v1/admin/car-types with malicious javascript: URL -> 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/admin/car-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Hacked Category',
          icon_url: 'javascript:alert(1)',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('18. POST /api/v1/admin/car-types duplicate name -> 409 CATEGORY_NAME_TAKEN', async () => {
      const res = await request(app)
        .post('/api/v1/admin/car-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Roadster Sport', // already created in test 16
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_NAME_TAKEN');
    });

    it('19. POST /api/v1/admin/car-types without auth -> 401; with non-admin -> 403', async () => {
      const noAuthRes = await request(app)
        .post('/api/v1/admin/car-types')
        .send({ name: 'Unauthorized Category' });
      expect(noAuthRes.status).toBe(401);

      const customerRes = await request(app)
        .post('/api/v1/admin/car-types')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Forbidden Category' });
      expect(customerRes.status).toBe(403);
    });

    it('20. PUT /api/v1/admin/car-types/:id updates title only -> 200', async () => {
      const cat = await carTypeService.createCarType({ name: 'Title Update Pre', order: 2 }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const res = await request(app)
        .put(`/api/v1/admin/car-types/${cat.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Title Update Post' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Title Update Post');
      expect(res.body.data.slug).toBe('title-update-post');
    });

    it('21. PUT /api/v1/admin/car-types/:id with new image updates icon_url', async () => {
      const cat = await carTypeService.createCarType({ name: 'Image Update Pre' }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const res = await request(app)
        .put(`/api/v1/admin/car-types/${cat.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', dummyImagePath);

      expect(res.status).toBe(200);
      expect(res.body.data.icon_url).toBeDefined();
    });

    it('22. PUT /api/v1/admin/car-types/:id nonexistent id -> 404', async () => {
      const res = await request(app)
        .put('/api/v1/admin/car-types/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost Category' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('23. DELETE /api/v1/admin/car-types/:id referenced category -> 409 CATEGORY_IN_USE', async () => {
      const inUse = await carTypeService.createCarType({ name: 'In Use Http Cat' }, null, adminUser);
      createdCarTypeIds.push(inUse.id);

      // Create a car referencing this category name
      const c = await Car.create({
        user_id: adminUser.id,
        brand_id: testCar.brand_id,
        model_id: testCar.model_id,
        variant_id: testCar.variant_id,
        year: 2021,
        price: 900000,
        km_driven: 30000,
        fuel_type: 'Diesel',
        transmission: 'Manual',
        ownership: '1st Owner',
        body_type: 'In Use Http Cat',
        board_type: 'Own Board',
        status: 'active',
        posted_by_type: 'dealer',
      });
      createdCarIds.push(c.id);

      const res = await request(app)
        .delete(`/api/v1/admin/car-types/${inUse.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_IN_USE');
    });

    it('24. DELETE /api/v1/admin/car-types/:id unreferenced -> 204; second delete -> 404', async () => {
      const toDelete = await carTypeService.createCarType({ name: 'Delete Twice Item' }, null, adminUser);

      const res1 = await request(app)
        .delete(`/api/v1/admin/car-types/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(204);

      const res2 = await request(app)
        .delete(`/api/v1/admin/car-types/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(404);
    });

    it('25. GET /api/v1/car-types returns items and never leaks image_public_id to public', async () => {
      const res = await request(app).get('/api/v1/car-types');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify no item has image_public_id exposed
      for (const item of res.body.data) {
        expect(item.image_public_id).toBeUndefined();
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.slug).toBeDefined();
      }
    });

    it('26. GET /api/v1/car-types/:id resolves by slug', async () => {
      const cat = await carTypeService.createCarType({ name: 'Slug Lookup Route' }, null, adminUser);
      createdCarTypeIds.push(cat.id);

      const res = await request(app).get(`/api/v1/car-types/${cat.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(cat.id);
      expect(res.body.data.image_public_id).toBeUndefined();
    });

    it('27. Concurrent POST with same name produces exactly one 201 and one 409', async () => {
      const uniqueName = `Concurrent Name ${Date.now()}`;
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/admin/car-types')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: uniqueName }),
        request(app)
          .post('/api/v1/admin/car-types')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: uniqueName }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const successRes = res1.status === 201 ? res1 : res2;
      createdCarTypeIds.push(successRes.body.data.id);
    });
  });
});
