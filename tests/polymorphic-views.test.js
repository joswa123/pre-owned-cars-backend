// tests/polymorphic-views.test.js
process.env.NODE_ENV = 'test';

const { View, CommercialVehicle } = require('../src/models');
const viewService = require('../src/services/viewService');
const viewController = require('../src/controllers/viewController');
const viewRoutes = require('../src/routes/v1/viewRoutes');
const commercialRoutes = require('../src/routes/v1/commercialRoutes');

describe('Phase 4 — Polymorphic Views Tracking Unit Tests', () => {
  describe('1. Model & Hooks', () => {
    it('should set target_type="car" and target_id=car_id when car_id is provided', async () => {
      const carId = '11111111-1111-1111-1111-111111111111';
      const instance = View.build({ car_id: carId });
      await View.runHooks('beforeValidate', instance);

      expect(instance.target_type).toBe('car');
      expect(instance.target_id).toBe(carId);
      expect(instance.car_id).toBe(carId);
    });

    it('should preserve commercial target_type and target_id without car_id', async () => {
      const commercialId = '22222222-2222-2222-2222-222222222222';
      const instance = View.build({ target_type: 'commercial', target_id: commercialId });
      await View.runHooks('beforeValidate', instance);

      expect(instance.target_type).toBe('commercial');
      expect(instance.target_id).toBe(commercialId);
      expect(instance.car_id).toBeUndefined();
    });

    it('should sync car_id if target_type is car and only target_id is provided', async () => {
      const carId = '33333333-3333-3333-3333-333333333333';
      const instance = View.build({ target_type: 'car', target_id: carId });
      await View.runHooks('beforeValidate', instance);

      expect(instance.target_type).toBe('car');
      expect(instance.target_id).toBe(carId);
      expect(instance.car_id).toBe(carId);
    });
  });

  describe('2. Route Handlers & Exports', () => {
    it('should export getCarViews and getCommercialViews from viewService', () => {
      expect(typeof viewService.getCarViews).toBe('function');
      expect(typeof viewService.getCommercialViews).toBe('function');
    });

    it('should export getCarViews and getCommercialViews from viewController', () => {
      expect(typeof viewController.getCarViews).toBe('function');
      expect(typeof viewController.getCommercialViews).toBe('function');
    });

    it('should register /car/:carId, /commercial/:id, and polymorphic /vehicle/:id routes', () => {
      const routes = viewRoutes.stack
        .filter((r) => r.route)
        .map((r) => ({
          path: r.route.path,
          methods: Object.keys(r.route.methods),
        }));

      const paths = routes.map((r) => r.path);
      expect(paths).toContain('/car/:carId');
      expect(paths).toContain('/commercial/:id');
      expect(paths).toContain('/commercial/:carId');
      expect(paths).toContain('/vehicle/:id');
      expect(paths).toContain('/vehicle/:carId');
    });

    it('should register /:id/view in commercialRoutes', () => {
      const routes = commercialRoutes.stack
        .filter((r) => r.route)
        .map((r) => ({
          path: r.route.path,
          methods: Object.keys(r.route.methods),
        }));

      const viewRoutesOnCommercial = routes.filter((r) => r.path === '/:id/view');
      expect(viewRoutesOnCommercial.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Model Associations', () => {
    it('should have associations between CommercialVehicle and View', () => {
      expect(CommercialVehicle.associations.views).toBeDefined();
      expect(CommercialVehicle.associations.views.foreignKey).toBe('target_id');
      expect(View.associations.commercialVehicle).toBeDefined();
      expect(View.associations.commercialVehicle.foreignKey).toBe('target_id');
    });
  });
});
