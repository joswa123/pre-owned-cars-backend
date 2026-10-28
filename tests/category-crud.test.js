'use strict';

const request = require('supertest');
const app = require('../src/app');
const { Category, CarType } = require('../src/models');

describe('Category vs CarType API separation', () => {
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

  it('GET /api/v1/car-types still returns car types (Sedan, SUV, etc.)', async () => {
    const res = await request(app).get('/api/v1/car-types');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(c => c.name);
    expect(names).toContain('Sedan');
    expect(names).toContain('SUV');
    expect(names).not.toContain('Spare parts');
  });
});
