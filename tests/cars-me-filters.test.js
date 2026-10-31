const request = require('supertest');
const app = require('../src/app');
const { createTempImageFile, cleanupTempFiles } = require('./helpers');

describe('Cars Me Advanced Filters and Location Verification Tests', () => {
  let userToken;
  let userId;
  let car1Id; // Petrol, 2021, 35000 km, 800000 price, Manual, Hatchback
  let car2Id; // Diesel, 2018, 120000 km, 1500000 price, Automatic, SUV
  let car3Id; // Petrol, 2015, 250000 km, 400000 price, Manual, Sedan

  beforeAll(async () => {
    const randomId = Math.floor(100000 + Math.random() * 900000);
    const userData = {
      full_name: `Filter Test User ${randomId}`,
      phone: `9${randomId}009`,
      email: `filter-me-${randomId}@test.com`,
      password: 'Password@123',
      role: 'customer',
      state: 'Tamil Nadu',
      district: 'Coimbatore',
      city: 'Gandhipuram',
    };

    const regRes = await request(app).post('/api/v1/auth/register').send(userData);
    const otp = regRes.body.data.otp;
    await request(app).post('/api/v1/auth/verify').send({ email: userData.email, code: otp });
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: userData.email,
      password: userData.password,
    });

    userToken = loginRes.body.data.accessToken;
    userId = loginRes.body.data.user.id;

    // Post Car 1: Petrol, 2021, 35,000 km, 800,000 price, Manual, Hatchback
    const img1 = createTempImageFile('car1.png');
    const res1 = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${userToken}`)
      .field('brand', 'Maruti Suzuki')
      .field('model', 'Swift')
      .field('variant', 'ZXi')
      .field('year', 2021)
      .field('price', 800000)
      .field('km_driven', 35000)
      .field('fuel_type', 'Petrol')
      .field('transmission', 'Manual')
      .field('ownership', '1st owner')
      .field('body_type', 'Hatchback')
      .field('board_type', 'own board')
      .field('color', 'Red')
      .field('number_plate', `TN38AB${Math.floor(1000 + Math.random() * 9000)}`)
      .attach('primary_image', img1);

    expect(res1.statusCode).toBe(200);
    car1Id = res1.body.data.car.id;

    // Post Car 2: Diesel, 2018, 120,000 km, 1,500,000 price, Automatic, SUV
    const img2 = createTempImageFile('car2.png');
    const res2 = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${userToken}`)
      .field('brand', 'Hyundai')
      .field('model', 'Creta')
      .field('variant', 'SX')
      .field('year', 2018)
      .field('price', 1500000)
      .field('km_driven', 120000)
      .field('fuel_type', 'Diesel')
      .field('transmission', 'Automatic')
      .field('ownership', '2nd owner')
      .field('body_type', 'SUV')
      .field('board_type', 'own board')
      .field('color', 'White')
      .field('number_plate', `TN38CD${Math.floor(1000 + Math.random() * 9000)}`)
      .attach('primary_image', img2);

    expect(res2.statusCode).toBe(200);
    car2Id = res2.body.data.car.id;

    // Post Car 3: Petrol, 2015, 250,000 km, 400,000 price, Manual, Sedan
    const img3 = createTempImageFile('car3.png');
    const res3 = await request(app)
      .post('/api/v1/cars')
      .set('Authorization', `Bearer ${userToken}`)
      .field('brand', 'Honda')
      .field('model', 'City')
      .field('variant', 'V')
      .field('year', 2015)
      .field('price', 400000)
      .field('km_driven', 250000)
      .field('fuel_type', 'Petrol')
      .field('transmission', 'Manual')
      .field('ownership', '3rd owner')
      .field('body_type', 'Sedan')
      .field('board_type', 'own board')
      .field('color', 'Silver')
      .field('number_plate', `TN38EF${Math.floor(1000 + Math.random() * 9000)}`)
      .attach('primary_image', img3);

    expect(res3.statusCode).toBe(200);
    car3Id = res3.body.data.car.id;
  });

  afterAll(() => {
    cleanupTempFiles();
  });

  test('1. EXACT USER URL FILTER: min_year=1970&max_year=2026&min_km=0&max_km=200000&fuel_types=Petrol&posted_within_days=90&min_price=100000&max_price=5000000&include_expired=false&status=active', async () => {
    const url = '/api/v1/cars/me?min_year=1970&max_year=2026&min_km=0&max_km=200000&fuel_types=Petrol&posted_within_days=90&min_price=100000&max_price=5000000&include_expired=false&status=active';
    const res = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.cars).toBeInstanceOf(Array);

    const carIds = res.body.data.cars.map(c => c.id);

    // Car 1 matches all criteria: Petrol, 35k km (<=200k), 800k price, 2021 year, active
    expect(carIds).toContain(car1Id);

    // Car 2 is Diesel, so it MUST NOT be returned when fuel_types=Petrol
    expect(carIds).not.toContain(car2Id);

    // Car 3 has 250,000 km (> max_km 200,000), so it MUST NOT be returned
    expect(carIds).not.toContain(car3Id);

    // Verify all returned cars strictly satisfy the filter constraints
    res.body.data.cars.forEach(car => {
      expect(car.user_id).toBe(userId);
      expect(car.status).toBe('active');
      expect(parseFloat(car.km_driven)).toBeLessThanOrEqual(200000);
      expect(parseFloat(car.km_driven)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(car.price)).toBeGreaterThanOrEqual(100000);
      expect(parseFloat(car.price)).toBeLessThanOrEqual(5000000);
      expect(parseInt(car.year, 10)).toBeGreaterThanOrEqual(1970);
      expect(parseInt(car.year, 10)).toBeLessThanOrEqual(2026);
      expect(car.fuel_type.toLowerCase()).toBe('petrol');
    });
  });

  test('2. Location fields check: district, city, cities, state must be present in response', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.cars.length).toBeGreaterThanOrEqual(3);

    res.body.data.cars.forEach(car => {
      // Must have state, district, city, cities
      expect(car).toHaveProperty('state');
      expect(car).toHaveProperty('district');
      expect(car).toHaveProperty('city');
      expect(car).toHaveProperty('cities');
      expect(car).toHaveProperty('stateName');
      expect(car).toHaveProperty('districtName');
      expect(car).toHaveProperty('cityName');
      expect(car).toHaveProperty('location_text');

      // State, district, and city objects must have valid names
      expect(car.state).toBeTruthy();
      expect(typeof car.state.name).toBe('string');
      expect(car.district).toBeTruthy();
      expect(typeof car.district.name).toBe('string');
      expect(car.city).toBeTruthy();
      expect(typeof car.city.name).toBe('string');
      expect(car.cities).toBeTruthy();
      expect(typeof car.cities.name).toBe('string');
    });
  });

  test('3. KM Range Filter on /cars/me: min_km=50000&max_km=150000 returns only Car 2', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?min_km=50000&max_km=150000')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    const carIds = res.body.data.cars.map(c => c.id);

    expect(carIds).toContain(car2Id);
    expect(carIds).not.toContain(car1Id);
    expect(carIds).not.toContain(car3Id);
  });

  test('4. Fuel Types Filter on /cars/me: fuel_types=Diesel returns only Car 2', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?fuel_types=Diesel')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    const carIds = res.body.data.cars.map(c => c.id);

    expect(carIds).toContain(car2Id);
    expect(carIds).not.toContain(car1Id);
    expect(carIds).not.toContain(car3Id);
  });

  test('5. Price Filter on /cars/me: max_price=500000 returns only Car 3', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?max_price=500000')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    const carIds = res.body.data.cars.map(c => c.id);

    expect(carIds).toContain(car3Id);
    expect(carIds).not.toContain(car1Id);
    expect(carIds).not.toContain(car2Id);
  });

  test('6. Year Filter on /cars/me: min_year=2020 returns only Car 1', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?min_year=2020')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    const carIds = res.body.data.cars.map(c => c.id);

    expect(carIds).toContain(car1Id);
    expect(carIds).not.toContain(car2Id);
    expect(carIds).not.toContain(car3Id);
  });

  test('7. Transmission Filter on /cars/me: transmissions=Automatic returns only Car 2', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?transmissions=Automatic')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    const carIds = res.body.data.cars.map(c => c.id);

    expect(carIds).toContain(car2Id);
    expect(carIds).not.toContain(car1Id);
    expect(carIds).not.toContain(car3Id);
  });

  test('8. Body Type Filter on /cars/me: body_types=Hatchback returns only Car 1', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?body_types=Hatchback')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    const carIds = res.body.data.cars.map(c => c.id);

    expect(carIds).toContain(car1Id);
    expect(carIds).not.toContain(car2Id);
    expect(carIds).not.toContain(car3Id);
  });

  test('9. Empty string query parameters are safely handled without 400 error', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me?min_year=1970&max_year=2026&min_km=0&max_km=200000&posted_within_days=90&color=&fuel_types=&brand=&model=')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

