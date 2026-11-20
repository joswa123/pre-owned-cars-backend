// tests/location-dealer-cars.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');
const locationRoutes = require('../src/routes/v1/locationRoutes');
const locationController = require('../src/controllers/locationController');

const describe = global.describe || ((name, fn) => { console.log(name); fn(); });
const it = global.it || ((name, fn) => { fn(); console.log('  ✓ ' + name); });

describe('Location Dealer Cars & Commercial Routes Tests', () => {
  it('Step 1: Verify location routes mount all dealer endpoints', () => {
    const routeLayers = locationRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const paths = routeLayers.map((r) => r.path);

    assert(paths.includes('/dealers'), 'Route GET /dealers should exist');
    assert(paths.includes('/dealers/:dealerId'), 'Route GET /dealers/:dealerId should exist');
    assert(paths.includes('/dealers/:dealerId/cars'), 'Route GET /dealers/:dealerId/cars should exist');
    assert(paths.includes('/dealers/:dealerId/commercial'), 'Route GET /dealers/:dealerId/commercial should exist');
    assert(paths.includes('/dealers/:dealerId/cars/filters'), 'Route GET /dealers/:dealerId/cars/filters should exist');
    assert(paths.includes('/dealers/:dealerId/commercial/filters'), 'Route GET /dealers/:dealerId/commercial/filters should exist');
  });

  it('Step 2: Verify locationController exports getDealerCars and getDealerCommercialVehicles', () => {
    assert.strictEqual(typeof locationController.getDealerCars, 'function');
    assert.strictEqual(typeof locationController.getDealerCommercialVehicles, 'function');
    assert.strictEqual(typeof locationController.getDealerProfile, 'function');
    assert.strictEqual(typeof locationController.getDealersByLocation, 'function');
  });
});
