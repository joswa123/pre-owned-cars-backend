// tests/merged-api-endpoints-audit.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');
const tests = [];
const describe = (name, fn) => { console.log(name); fn(); };
const it = (name, fn) => { tests.push({ name, fn }); };

// Models & Routes
const { User, Car, CommercialVehicle, Lead, CarReport, View, Wishlist } = require('../src/models');
const app = require('../src/app');
const commercialRoutes = require('../src/routes/v1/commercialRoutes');
const leadRoutes = require('../src/routes/v1/leadRoutes');
const viewRoutes = require('../src/routes/v1/viewRoutes');
const dealerRoutes = require('../src/routes/v1/dealerRoutes');
const locationRoutes = require('../src/routes/v1/locationRoutes');
const wishlistRoutes = require('../src/routes/v1/wishlistRoutes');

// Services & Controllers
const commercialVehicleService = require('../src/services/commercialVehicleService');
const leadService = require('../src/services/leadService');
const carReportService = require('../src/services/carReportService');
const viewService = require('../src/services/viewService');
const dashboardService = require('../src/services/dashboardService');
const dealerService = require('../src/services/dealerService');
const wishlistService = require('../src/services/wishlistService');

describe('=== Master Merged API & Route Audit Test Suite ===', () => {
  it('1. Model Associations check (Both Branches)', () => {
    // parallel-server features
    assert(CommercialVehicle.associations.wishlists, 'CommercialVehicle.wishlists should exist');
    assert(CommercialVehicle.associations.images, 'CommercialVehicle.images should exist');

    // main features
    assert(CommercialVehicle.associations.views, 'CommercialVehicle.views should exist');
    assert(CommercialVehicle.associations.leads, 'CommercialVehicle.leads should exist');
    assert(CommercialVehicle.associations.reports, 'CommercialVehicle.reports should exist');
    assert(User.associations.postedCommercialVehicles, 'User.postedCommercialVehicles should exist');
    assert(Lead.associations.commercialVehicle, 'Lead.commercialVehicle should exist');
    assert(CarReport.associations.commercialVehicle, 'CarReport.commercialVehicle should exist');
    assert(View.associations.commercialVehicle, 'View.commercialVehicle should exist');
  });

  it('2. Commercial Routes verification (Media, B2B, Similar, Recommended, Views)', () => {
    const paths = commercialRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(paths.includes('/similar-recommended'), 'Should have /similar-recommended');
    assert(paths.includes('/recommended'), 'Should have /recommended');
    assert(paths.includes('/:id/similar'), 'Should have /:id/similar');
    assert(paths.includes('/:id/recommended'), 'Should have /:id/recommended');
    assert(paths.includes('/seller/:sellerId'), 'Should have /seller/:sellerId');
    assert(paths.includes('/:id'), 'Should have /:id');
    assert(paths.includes('/:id/view'), 'Should have /:id/view');
    assert(paths.includes('/:id/video'), 'Should have /:id/video');
    assert(paths.includes('/:id/audio'), 'Should have /:id/audio');
  });

  it('3. Lead Routes verification (Polymorphic drilldown, seller, buyer)', () => {
    const paths = leadRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(paths.includes('/car/:carId'), 'Should have /car/:carId');
    assert(paths.includes('/commercial/:carId'), 'Should have /commercial/:carId');
    assert(paths.includes('/vehicle/:carId'), 'Should have /vehicle/:carId');
    assert(paths.includes('/seller'), 'Should have /seller');
    assert(paths.includes('/seller/leads'), 'Should have /seller/leads');
    assert(paths.includes('/seller/summary'), 'Should have /seller/summary');
    assert(paths.includes('/seller/commercial/:carId'), 'Should have /seller/commercial/:carId');
    assert(paths.includes('/me'), 'Should have /me');
  });

  it('4. View Routes verification (Cars, Commercial, Vehicle)', () => {
    const paths = viewRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(paths.includes('/car/:carId'), 'Should have /car/:carId');
    assert(paths.includes('/commercial/:id'), 'Should have /commercial/:id');
    assert(paths.includes('/vehicle/:id'), 'Should have /vehicle/:id');
  });

  it('5. Dealer & Location Routes verification (Commercial Inventory & Filters)', () => {
    const dealerPaths = dealerRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(dealerPaths.includes('/:id/commercial'), 'Should have /:id/commercial');
    assert(dealerPaths.includes('/:id/commercial/filters'), 'Should have /:id/commercial/filters');

    const locPaths = locationRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(locPaths.includes('/dealers/:dealerId'), 'Should have /dealers/:dealerId');
    assert(locPaths.includes('/dealers/:dealerId/commercial'), 'Should have /dealers/:dealerId/commercial');
  });

  it('6. Wishlist Routes verification (Commercial & Cars)', () => {
    const paths = wishlistRoutes.stack.filter(r => r.route).map(r => r.route.path);
    assert(paths.includes('/'), 'Should have root / for GET/POST/DELETE');
    assert(paths.includes('/commercial/:commercialId'), 'Should have /commercial/:commercialId');
    assert(paths.includes('/car/:carId'), 'Should have /car/:carId');
  });

  it('7. Service Function Exports check across all merged modules', () => {
    // Commercial Service
    assert.strictEqual(typeof commercialVehicleService.getCommercialVehicles, 'function');
    assert.strictEqual(typeof commercialVehicleService.getCommercialVehicleById, 'function');
    assert.strictEqual(typeof commercialVehicleService.getSimilarRecommended, 'function');
    assert.strictEqual(typeof commercialVehicleService.getSellerCommercialListings, 'function');
    assert.strictEqual(typeof commercialVehicleService.recordView, 'function');
    assert.strictEqual(typeof commercialVehicleService.uploadCommercialVideo, 'function');
    assert.strictEqual(typeof commercialVehicleService.uploadCommercialAudio, 'function');

    // Lead Service
    assert.strictEqual(typeof leadService.createLead, 'function');
    assert.strictEqual(typeof leadService.getSellerLeads, 'function');
    assert.strictEqual(typeof leadService.getBuyerLeads, 'function');
    assert.strictEqual(typeof leadService.getLeadSummary, 'function');
    assert.strictEqual(typeof leadService.getCarLeads, 'function');

    // Reports Service
    assert.strictEqual(typeof carReportService.createReport, 'function');
    assert.strictEqual(typeof carReportService.getReports, 'function');
    assert.strictEqual(typeof carReportService.getReportById, 'function');

    // Views Service
    assert.strictEqual(typeof viewService.getCarViews, 'function');
    assert.strictEqual(typeof viewService.getCommercialViews, 'function');

    // Dashboard Service
    assert.strictEqual(typeof dashboardService.getDashboardSummary, 'function');
    assert.strictEqual(typeof dashboardService.invalidateDashboardCache, 'function');

    // Dealer Service
    assert.strictEqual(typeof dealerService.getDealerById, 'function');
    assert.strictEqual(typeof dealerService.getDealerCommercialFilters, 'function');

    // Wishlist Service
    assert.strictEqual(typeof wishlistService.getWishlist, 'function');
    assert.strictEqual(typeof wishlistService.addToWishlist, 'function');
    assert.strictEqual(typeof wishlistService.removeFromWishlist, 'function');
    assert.strictEqual(typeof wishlistService.toggleWishlist, 'function');
  });
});

(async () => {
  for (const t of tests) {
    await t.fn();
    console.log('  ✓ ' + t.name);
  }
  console.log('\nMaster API audit completed successfully! All endpoints and services verified.\n');
})().catch((err) => {
  console.error('\nAudit failed:', err);
  process.exit(1);
});
