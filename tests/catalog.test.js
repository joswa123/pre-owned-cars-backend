const request = require('supertest');
const app = require('../src/app');
const { Brand, Model, Variant } = require('../src/models');
const carCatalogService = require('../src/services/carCatalogService');

describe('Catalog API Integration Tests', () => {
  let testBrand;
  let testModel;

  beforeAll(async () => {
    // Seed test brand and model
    testBrand = await Brand.create({
      name: 'Catalog Test Brand',
      logo: 'https://example.com/logo.png',
      is_active: true,
    });

    testModel = await Model.create({
      name: 'Catalog Test Model',
      brandId: testBrand.id,
      body_type: 'SUV',
      is_active: true,
    });

    await Variant.create({
      name: 'Catalog Test Variant',
      model_id: testModel.id,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      is_active: true,
    });
  });

  afterAll(async () => {
    if (testBrand) {
      await Variant.destroy({ where: { model_id: testModel.id } });
      await Model.destroy({ where: { id: testModel.id } });
      await Brand.destroy({ where: { id: testBrand.id } });
    }
  });

  test('GET /api/v1/catalog/brands - returns brand list', async () => {
    const res = await request(app).get('/api/v1/catalog/brands');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.brands)).toBe(true);
  });

  test('GET /api/v1/catalog/brands/:brandId/models - lookup by UUID', async () => {
    const res = await request(app).get(`/api/v1/catalog/brands/${testBrand.id}/models`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.models.length).toBeGreaterThan(0);
    expect(res.body.data.models[0].name).toBe('Catalog Test Model');
  });

  test('GET /api/v1/catalog/brands/:brandId/models - lookup by Brand Name / Slug', async () => {
    const res = await request(app).get('/api/v1/catalog/brands/catalog-test-brand/models');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.models.length).toBeGreaterThan(0);
    expect(res.body.data.models[0].name).toBe('Catalog Test Model');
  });

  test('GET /api/v1/catalog/models/:modelId/variants - lookup by Model Name / Slug', async () => {
    const res = await request(app).get('/api/v1/catalog/models/catalog-test-model/variants');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.variants.length).toBeGreaterThan(0);
    expect(res.body.data.variants[0].name).toBe('Catalog Test Variant');
  });

  test('GET /api/v1/catalog/brands/:brandId/models - returns 404 for non-existent brand', async () => {
    const res = await request(app).get('/api/v1/catalog/brands/non-existent-brand-xyz/models');
    expect(res.statusCode).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Brand not found.');
  });
});
