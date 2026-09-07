const request = require('supertest');
const app = require('../src/app');
const {
  createCarSchema,
  updateCarSchema,
  mapToDbValues,
  FUEL_TYPES_IN,
  TRANSMISSION_TYPES_IN,
  FUEL_TYPE_MAP,
  TRANSMISSION_MAP,
} = require('../src/validations/carValidation');

describe('Fuel Type & Transmission Validation and Normalization Tests', () => {
  describe('Joi Validation Schema', () => {
    const baseValidCar = {
      brand_id: '11111111-1111-1111-1111-111111111111',
      model_id: '22222222-2222-2222-2222-222222222222',
      body_type: 'SUV',
      board_type: 'own board',
      year: 2022,
      price: 500000,
      km_driven: 15000,
      ownership: '1st Owner',
      fuel_type: 'Petrol',
      transmission: 'Manual',
      state_id: '33333333-3333-3333-3333-333333333333',
      city_id: '44444444-4444-4444-4444-444444444444',
    };

    const supportedFuelTypes = [
      'Petrol',
      'Diesel',
      'CNG',
      'Electric',
      'Hybrid',
      'Hybrid (Electric + Petrol)',
      'Mild Hybrid(Electric + Petrol)',
      'Mild Hybrid (Electric + Diesel)',
      'Plug-in Hybrid (Electric + Petrol)',
      'LPG',
    ];

    test('should accept all supported fuel types', () => {
      for (const fuel of supportedFuelTypes) {
        const { error, value } = createCarSchema.validate({
          ...baseValidCar,
          fuel_type: fuel,
        });
        expect(error).toBeUndefined();
        expect(value.fuel_type).toBe(fuel.toLowerCase());
      }
    });

    test('should accept all case-insensitive fuel types', () => {
      for (const fuel of supportedFuelTypes) {
        const { error, value } = createCarSchema.validate({
          ...baseValidCar,
          fuel_type: fuel.toLowerCase(),
        });
        expect(error).toBeUndefined();
        expect(value.fuel_type).toBe(fuel.toLowerCase());
      }
    });

    const supportedTransmissions = [
      'Manual',
      'Automatic',
      'Automatic (TC)',
      'Automatic (DCT)',
      'Automatic (AMT)',
      'Automatic (CVT)',
      'Automatic (e-CVT)',
      'Clutchless Manual (IMT)',
      'Clutchless Manual',
      'AMT',
      'IMT',
      'CVT',
      'DCT',
      'TC',
      'e-CVT',
    ];

    test('should accept all supported transmissions', () => {
      for (const transmission of supportedTransmissions) {
        const { error, value } = createCarSchema.validate({
          ...baseValidCar,
          transmission,
        });
        expect(error).toBeUndefined();
        expect(value.transmission).toBe(transmission.toLowerCase());
      }
    });

    test('should accept all case-insensitive transmissions', () => {
      for (const transmission of supportedTransmissions) {
        const { error, value } = createCarSchema.validate({
          ...baseValidCar,
          transmission: transmission.toLowerCase(),
        });
        expect(error).toBeUndefined();
        expect(value.transmission).toBe(transmission.toLowerCase());
      }
    });

    test('should reject invalid fuel type', () => {
      const { error } = createCarSchema.validate({
        ...baseValidCar,
        fuel_type: 'RocketFuel',
      });
      expect(error).toBeDefined();
    });

    test('should reject invalid transmission', () => {
      const { error } = createCarSchema.validate({
        ...baseValidCar,
        transmission: 'PedalPower',
      });
      expect(error).toBeDefined();
    });
  });

  describe('mapToDbValues Normalization', () => {
    test('should normalize complex hybrid fuel types into DB standard strings', () => {
      const input = {
        fueltype: 'mild hybrid (electric + petrol)',
        transmission: 'automatic (e-cvt)',
      };
      const mapped = mapToDbValues(input);
      expect(mapped.fuel_type).toBe('Mild Hybrid(Electric + Petrol)');
      expect(mapped.transmission).toBe('Automatic (e-CVT)');
    });

    test('should normalize alias transmissions (IMT, AMT, CVT, DCT, TC)', () => {
      expect(mapToDbValues({ transmission: 'imt' }).transmission).toBe('Clutchless Manual (IMT)');
      expect(mapToDbValues({ transmission: 'amt' }).transmission).toBe('Automatic (AMT)');
      expect(mapToDbValues({ transmission: 'cvt' }).transmission).toBe('Automatic (CVT)');
      expect(mapToDbValues({ transmission: 'dct' }).transmission).toBe('Automatic (DCT)');
      expect(mapToDbValues({ transmission: 'tc' }).transmission).toBe('Automatic (TC)');
      expect(mapToDbValues({ transmission: 'e-cvt' }).transmission).toBe('Automatic (e-CVT)');
    });

    test('should normalize Diesel Mild Hybrid and Plug-in Hybrid', () => {
      expect(mapToDbValues({ fuel_type: 'mild hybrid (electric + diesel)' }).fuel_type)
        .toBe('Mild Hybrid (Electric + Diesel)');
      expect(mapToDbValues({ fuel_type: 'plug-in hybrid (electric + petrol)' }).fuel_type)
        .toBe('Plug-in Hybrid (Electric + Petrol)');
    });
  });

  describe('GET /api/v1/cars Filter Endpoints', () => {
    test('should filter by single new fuel type without query error', async () => {
      const res = await request(app).get('/api/v1/cars?fuel_type=Mild%20Hybrid(Electric%20%2B%20Petrol)');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('should filter by multiple fuel types with new values', async () => {
      const res = await request(app).get('/api/v1/cars?fuel_types=Petrol,Mild Hybrid (Electric + Diesel),Electric');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('should filter by single new transmission without query error', async () => {
      const res = await request(app).get('/api/v1/cars?transmission=Automatic%20(e-CVT)');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('should filter by multiple transmissions with new values', async () => {
      const res = await request(app).get('/api/v1/cars?transmissions=Manual,Clutchless Manual (IMT),Automatic (DCT)');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});
