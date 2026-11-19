// tests/commercial-catalog-counts.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');
const commercialRoutes = require('../src/routes/v1/commercialRoutes');
const commercialVehicleService = require('../src/services/commercialVehicleService');
const commercialVehicleController = require('../src/controllers/commercialVehicleController');

const describe = global.describe || ((name, fn) => { console.log(name); fn(); });
const it = global.it || ((name, fn) => { fn(); console.log('  ✓ ' + name); });

describe('Commercial Vehicle Types & Brands with Counts API Tests', () => {
  it('Step 1: Verify commercial routes mount /vehicle-types, /types, and /brands before /:id', () => {
    const routeLayers = commercialRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const paths = routeLayers.map((r) => r.path);

    const vehicleTypesIdx = paths.indexOf('/vehicle-types');
    const typesIdx = paths.indexOf('/types');
    const brandsIdx = paths.indexOf('/brands');
    const idIdx = paths.indexOf('/:id');

    assert(vehicleTypesIdx !== -1, 'Route /vehicle-types should be registered');
    assert(typesIdx !== -1, 'Route /types should be registered');
    assert(brandsIdx !== -1, 'Route /brands should be registered');
    assert(idIdx !== -1, 'Route /:id should be registered');

    // Crucial check: /vehicle-types, /types, /brands MUST precede /:id in router stack
    assert(vehicleTypesIdx < idIdx, '/vehicle-types must be mounted before /:id');
    assert(typesIdx < idIdx, '/types must be mounted before /:id');
    assert(brandsIdx < idIdx, '/brands must be mounted before /:id');
  });

  it('Step 2: Verify controller exports handler functions', () => {
    assert.strictEqual(typeof commercialVehicleController.getCommercialVehicleTypes, 'function');
    assert.strictEqual(typeof commercialVehicleController.getCommercialBrands, 'function');
  });

  it('Step 3: Verify service exports count retrieval functions', () => {
    assert.strictEqual(typeof commercialVehicleService.getCommercialVehicleTypesWithCounts, 'function');
    assert.strictEqual(typeof commercialVehicleService.getCommercialBrandsWithCounts, 'function');
  });
});
