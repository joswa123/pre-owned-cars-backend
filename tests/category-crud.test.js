'use strict';

const request = require('supertest');
const app = require('../src/app');
const redisClient = require('../src/config/redis');
const { Category, CarType } = require('../src/models');

describe('Category vs CarType API separation', () => {
  beforeAll(async () => {
    if (redisClient && redisClient.isOpen) {
      for (const pattern of ['__express__/api/v1/car-types*', 'car-types:v*']) {
        const keys = await redisClient.keys(pattern);
        if (keys && keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    }
  });
  it('GET /api/v1/categories returns items from categories table', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(c => c.name);
    // Should contain categories like Car, Bike, Scooty, Commercial, Spare parts
    expect(names).toContain('Car');
    expect(names).toContain('Bike');
    // Should NOT contain car types
    expect(names).not.toContain('Sedan');
    expect(names).not.toContain('Hatchback');
  });

  it('GET /api/v1/categroeries (typo alias) also returns items from categories table', async () => {
    const res = await request(app).get('/api/v1/categroeries');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(c => c.name);
    expect(names).toContain('Car');
  });

  it('GET /api/v1/categories/:slug returns single category', async () => {
    const res = await request(app).get('/api/v1/categories/car');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('car');
    expect(res.body.data.name).toBe('Car');
  });

  it('GET /api/v1/car-types returns only car types and excludes commercial types', async () => {
    const commercialCat = await Category.findOne({ where: { slug: 'commercial' } });
    const activeCommercialTypes = commercialCat
      ? await CarType.findAll({ where: { category_id: commercialCat.id, is_active: true } })
      : [];

    const res = await request(app).get('/api/v1/car-types');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(c => c.name);
    const ids = res.body.data.map(c => c.id);
    expect(names).toContain('Sedan');
    expect(names).toContain('SUV');
    expect(names).not.toContain('Spare parts');
    expect(names).not.toContain('Trucks');
    expect(names).not.toContain('Buses');
    expect(names).not.toContain('Tractors');
    expect(names).not.toContain('Auto-rickshaws & E-rickshaws');
    for (const ct of activeCommercialTypes) {
      expect(ids).not.toContain(ct.id);
      expect(names).not.toContain(ct.name);
    }
  });

  it('GET /api/v1/car-types?category=commercial returns commercial types when requested explicitly', async () => {
    const commercialCat = await Category.findOne({ where: { slug: 'commercial' } });
    const activeCommercialTypes = commercialCat
      ? await CarType.findAll({ where: { category_id: commercialCat.id, is_active: true } })
      : [];

    const res = await request(app).get('/api/v1/car-types?category=commercial');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(c => c.name);
    expect(activeCommercialTypes.length).toBeGreaterThan(0);
    for (const ct of activeCommercialTypes) {
      expect(names).toContain(ct.name);
    }
    expect(names).not.toContain('Sedan');
    expect(names).not.toContain('SUV');
  });

  it('GET /api/v1/car-types?include_all=true returns both car and commercial types', async () => {
    const commercialCat = await Category.findOne({ where: { slug: 'commercial' } });
    const activeCommercialTypes = commercialCat
      ? await CarType.findAll({ where: { category_id: commercialCat.id, is_active: true } })
      : [];

    const res = await request(app).get('/api/v1/car-types?include_all=true');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(c => c.name);
    expect(names).toContain('Sedan');
    for (const ct of activeCommercialTypes) {
      expect(names).toContain(ct.name);
    }
  });
});
