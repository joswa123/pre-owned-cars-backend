const dealerService = require('../src/services/dealerService');
const dealerController = require('../src/controllers/dealerController');
const { Car, User, Brand, Model } = require('../src/models');
const redisClient = require('../src/config/redis');

describe('Dealer Inventory Filtering System', () => {
  describe('Controller - Parameter Validation & Auth Resolution', () => {
    test('resolveDealerId: requesting "me" without authentication returns 401', async () => {
      const req = {
        params: { id: 'me' },
        user: null,
      };
      const res = {};
      const next = jest.fn();

      await dealerController.getDealerCarFilters(req, res, next);
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toMatch(/Authentication required/i);
    });

    test('getDealerCars: invalid sort_by throws 400', async () => {
      const req = {
        params: { id: '00000000-0000-0000-0000-000000000001' },
        query: { sort_by: 'unauthorized_column' },
        user: null,
      };
      const res = {};
      const next = jest.fn();

      await dealerController.getDealerCars(req, res, next);
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/Invalid sort_by/i);
    });

    test('getDealerCars: invalid sort_order throws 400', async () => {
      const req = {
        params: { id: '00000000-0000-0000-0000-000000000001' },
        query: { sort_order: 'SIDEWAYS' },
        user: null,
      };
      const res = {};
      const next = jest.fn();

      await dealerController.getDealerCars(req, res, next);
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/Invalid sort_order/i);
    });
  });

  describe('Service - Facet Aggregation Contract', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    test('getDealerCarFilters returns empty arrays and null min/max when dealer has 0 visible cars', async () => {
      const dealerId = '00000000-0000-0000-0000-000000000001';

      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: dealerId,
        role: 'dealer',
        status: 'approved',
      });

      // Mock redis cache miss
      jest.spyOn(redisClient, 'isOpen', 'get').mockReturnValue(false);

      // Mock Car.findOne returning 0 cars
      jest.spyOn(Car, 'findOne').mockResolvedValue({
        total_cars: 0,
        min_price: null,
        max_price: null,
        min_km: null,
        max_km: null,
        min_year: null,
        max_year: null,
      });

      const result = await dealerService.getDealerCarFilters(dealerId, 'public');

      expect(result).toBeDefined();
      expect(result.view).toBe('public');
      expect(result.generated_at).toBeDefined();
      expect(result.semantics).toMatch(/unfiltered status-scoped/i);
      expect(result.facets).toEqual({
        total_cars: 0,
        price_range: { min: null, max: null },
        km_range: { min: null, max: null },
        year_range: { min: null, max: null },
        brands: [],
        models: [],
        fuel_types: [],
        transmissions: [],
        body_types: [],
        ownerships: [],
        board_types: [],
      });
    });

    test('getDealerCarFilters formats buckets correctly when cars exist', async () => {
      const dealerId = '00000000-0000-0000-0000-000000000002';

      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: dealerId,
        role: 'dealer',
        status: 'approved',
      });

      jest.spyOn(redisClient, 'isOpen', 'get').mockReturnValue(false);

      jest.spyOn(Car, 'findOne').mockResolvedValue({
        total_cars: 2,
        min_price: 300000,
        max_price: 750000,
        min_km: 15000,
        max_km: 45000,
        min_year: 2018,
        max_year: 2022,
      });

      jest.spyOn(Car, 'findAll')
        .mockResolvedValueOnce([{ id: 'brand-1', name: 'Hyundai', count: 2 }]) // brands
        .mockResolvedValueOnce([{ id: 'model-1', brand_id: 'brand-1', name: 'i20', count: 2 }]) // models
        .mockResolvedValueOnce([{ name: 'Petrol', count: 2 }]) // fuel
        .mockResolvedValueOnce([{ name: 'Manual', count: 2 }]) // transmission
        .mockResolvedValueOnce([{ name: 'Hatchback', count: 2 }]) // body
        .mockResolvedValueOnce([{ name: '1st Owner', count: 2 }]) // ownership
        .mockResolvedValueOnce([{ name: 'Own Board', count: 2 }]); // board

      const result = await dealerService.getDealerCarFilters(dealerId, 'owner');

      expect(result.view).toBe('owner');
      expect(result.facets.total_cars).toBe(2);
      expect(result.facets.price_range).toEqual({ min: 300000, max: 750000 });
      expect(result.facets.brands).toEqual([{ id: 'brand-1', name: 'Hyundai', count: 2 }]);
      expect(result.facets.models).toEqual([{ id: 'model-1', brand_id: 'brand-1', name: 'i20', count: 2 }]);
      expect(result.facets.fuel_types).toEqual([{ name: 'Petrol', count: 2 }]);
    });
  });

  describe('Service - Inventory Query & Pagination', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    test('getDealerCars executes with correct pagination and status scoping', async () => {
      const dealerId = '00000000-0000-0000-0000-000000000003';

      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: dealerId,
        role: 'dealer',
        status: 'approved',
      });

      jest.spyOn(redisClient, 'isOpen', 'get').mockReturnValue(false);

      jest.spyOn(Car, 'count').mockResolvedValue(15);
      jest.spyOn(Car, 'findAll').mockResolvedValue([
        { id: 'car-1', price: 500000, year: 2020 },
      ]);

      const result = await dealerService.getDealerCars(
        dealerId,
        { min_price: '400000', fuel_type: 'Petrol' },
        1,
        10,
        'price',
        'ASC',
        'public'
      );

      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 15,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      });
      expect(result.cars.length).toBe(1);
    });
  });
});
