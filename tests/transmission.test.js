const request = require('supertest');
const app = require('../src/app');
const { Transmission } = require('../src/models');

describe('Transmission API Tests', () => {
  test('GET /api/v1/transmissions - returns list of transmissions including IMT', async () => {
    const res = await request(app).get('/api/v1/transmissions');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const names = res.body.data.map(t => (t.transmission_name || '').toUpperCase());
    expect(names).toContain('IMT');
    expect(names).toContain('MANUAL');
    expect(names).toContain('AUTOMATIC');
    expect(names).toContain('AMT');
  });

  test('GET /api/v1/transmissions/:id - returns transmission details by ID', async () => {
    const imt = await Transmission.findOne({
      where: { transmission_name: 'IMT' }
    });

    expect(imt).not.toBeNull();

    const res = await request(app).get(`/api/v1/transmissions/${imt.transmission_id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transmission_name).toBe('IMT');
  });

  test('GET /api/v1/transmissions/:id - returns 404 for invalid ID', async () => {
    const res = await request(app).get('/api/v1/transmissions/11111111-1111-1111-1111-111111111111');
    expect(res.statusCode).toBe(404);
  });
});
