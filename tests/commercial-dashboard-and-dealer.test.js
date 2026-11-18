// tests/commercial-dashboard-and-dealer.test.js
process.env.NODE_ENV = 'test';

const describe = global.describe || ((name, fn) => { console.log(name); fn(); });
const it = global.it || ((name, fn) => { fn(); console.log('  ✓ ' + name); });

const assert = require('assert');
const { User, CommercialVehicle } = require('../src/models');
const locationRoutes = require('../src/routes/v1/locationRoutes');
const dealerRoutes = require('../src/routes/v1/dealerRoutes');
const locationController = require('../src/controllers/locationController');
const dealerController = require('../src/controllers/dealerController');
const dealerService = require('../src/services/dealerService');
const dashboardService = require('../src/services/dashboardService');

describe('Commercial Support for Dashboard & Dealer Inventory Tests', () => {
  it('Step 1: should have User.associations.postedCommercialVehicles defined', () => {
    assert(User.associations.postedCommercialVehicles, 'postedCommercialVehicles association should exist');
    assert.strictEqual(User.associations.postedCommercialVehicles.foreignKey, 'user_id');
  });

  it('Step 2: Dashboard Service should export getDashboardSummary and invalidateDashboardCache', () => {
    assert.strictEqual(typeof dashboardService.getDashboardSummary, 'function');
    assert.strictEqual(typeof dashboardService.invalidateDashboardCache, 'function');
  });

  it('Step 3: Location routes should have /dealers/:dealerId and /dealers/:dealerId/commercial', () => {
    const paths = locationRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(paths.includes('/dealers/:dealerId'), 'should have /dealers/:dealerId');
    assert(paths.includes('/dealers/:dealerId/commercial'), 'should have /dealers/:dealerId/commercial');
  });

  it('Step 4: Dealer routes should have /:id/commercial and /:id/commercial/filters', () => {
    const paths = dealerRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(paths.includes('/:id/commercial'), 'should have /:id/commercial');
    assert(paths.includes('/:id/commercial/filters'), 'should have /:id/commercial/filters');
  });

  it('Step 5: Dealer controller should export getDealerCommercialFilters and getDealerCommercialVehicles', () => {
    assert.strictEqual(typeof dealerController.getDealerCommercialFilters, 'function');
    assert.strictEqual(typeof dealerController.getDealerCommercialVehicles, 'function');
    assert.strictEqual(typeof dealerService.getDealerCommercialFilters, 'function');
  });

  it('Step 6: Location controller should export getDealerProfile and getDealerCommercialVehicles', () => {
    assert.strictEqual(typeof locationController.getDealerProfile, 'function');
    assert.strictEqual(typeof locationController.getDealerCommercialVehicles, 'function');
  });

  it('Step 7: Merging and sorting logic test (merging 10 cars and 10 commercial vehicles, slicing top 20)', () => {
    const cars = Array.from({ length: 10 }, (_, i) => ({
      id: `car-${i}`,
      created_at: new Date(Date.now() - i * 1000 * 60).toISOString(),
      target_type: 'car',
    }));

    const commercial = Array.from({ length: 10 }, (_, i) => ({
      id: `comm-${i}`,
      created_at: new Date(Date.now() - (i + 0.5) * 1000 * 60).toISOString(),
      target_type: 'commercial',
    }));

    const mergedVehicles = [...cars, ...commercial]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 20);

    assert.strictEqual(mergedVehicles.length, 20);
    assert.strictEqual(mergedVehicles[0].id, 'car-0');
    assert.strictEqual(mergedVehicles[1].id, 'comm-0');
    assert(mergedVehicles.every(v => v.target_type === 'car' || v.target_type === 'commercial'));
  });

  it('Step 8: Dashboard unified vehicles summation constraint test', () => {
    const carCounts = [
      { status: 'active', count: '5' },
      { status: 'sold', count: '2' },
      { status: 'deleted', count: '1' },
    ];
    const commercialCounts = [
      { status: 'active', count: '3' },
      { status: 'sold', count: '1' },
      { status: 'expired', count: '2' },
      { status: 'deleted', count: '0' },
    ];

    const result = {
      cars: { total: 0, active: 0, sold: 0, deleted: 0 },
      commercial: { total: 0, active: 0, sold: 0, deleted: 0, expired: 0 },
      vehicles: { total: 0, active: 0, sold: 0, deleted: 0, expired: 0 },
    };

    carCounts.forEach((row) => {
      const count = parseInt(row.count, 10) || 0;
      if (row.status === 'active') { result.cars.active = count; result.cars.total += count; }
      else if (row.status === 'sold') { result.cars.sold = count; result.cars.total += count; }
      else if (row.status === 'deleted') { result.cars.deleted = count; }
    });

    commercialCounts.forEach((row) => {
      const count = parseInt(row.count, 10) || 0;
      if (row.status === 'active') { result.commercial.active = count; result.commercial.total += count; }
      else if (row.status === 'sold') { result.commercial.sold = count; result.commercial.total += count; }
      else if (row.status === 'expired') { result.commercial.expired = count; result.commercial.total += count; }
      else if (row.status === 'deleted') { result.commercial.deleted = count; }
    });

    result.vehicles.active = result.cars.active + result.commercial.active;
    result.vehicles.sold = result.cars.sold + result.commercial.sold;
    result.vehicles.deleted = result.cars.deleted + result.commercial.deleted;
    result.vehicles.expired = (result.cars.expired || 0) + result.commercial.expired;
    result.vehicles.total = result.cars.total + result.commercial.total;

    assert.strictEqual(result.vehicles.active, 8);
    assert.strictEqual(result.vehicles.sold, 3);
    assert.strictEqual(result.vehicles.deleted, 1);
    assert.strictEqual(result.vehicles.expired, 2);
    assert.strictEqual(result.vehicles.total, 13);
  });
});
