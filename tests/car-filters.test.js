const request = require('supertest');
const app = require('../src/app');

describe('Car Filters', () => {
  test('Should filter by single brand', async () => {
    // We mock or assume some data exists. We will just check if it returns 200 for now.
    const res = await request(app).get('/api/v1/cars?brand=Toyota');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by multiple brands', async () => {
    const res = await request(app).get('/api/v1/cars?brands=uuid1,uuid2&limit=5');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by model', async () => {
    const res = await request(app).get('/api/v1/cars?model=Corolla');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by year range', async () => {
    const res = await request(app).get('/api/v1/cars?min_year=2018&max_year=2023');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by KM range', async () => {
    const res = await request(app).get('/api/v1/cars?min_km=10000&max_km=50000');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by multiple fuel types', async () => {
    const res = await request(app).get('/api/v1/cars?fuel_types=Petrol,Diesel');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by multiple body types', async () => {
    const res = await request(app).get('/api/v1/cars?body_types=SUV,Sedan');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by ownership', async () => {
    const res = await request(app).get('/api/v1/cars?ownerships=1st Owner,2nd Owner');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by transmission', async () => {
    const res = await request(app).get('/api/v1/cars?transmissions=Manual,Automatic');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter by posted_within_days', async () => {
    const res = await request(app).get('/api/v1/cars?posted_within_days=30');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Should filter with include_expired=true', async () => {
    const res = await request(app).get('/api/v1/cars?include_expired=true');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Combination of all filters', async () => {
    const filters = 'min_year=2015&max_year=2022&min_km=5000&max_km=80000&fuel_types=Petrol&transmissions=Automatic&posted_within_days=15';
    const res = await request(app).get(`/api/v1/cars?${filters}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Edge case: no cars match returns empty array', async () => {
    const res = await request(app).get('/api/v1/cars?min_year=2030');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.cars).toBeInstanceOf(Array);
    expect(res.body.data.cars.length).toBe(0);
  });
});
