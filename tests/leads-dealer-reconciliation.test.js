// tests/leads-dealer-reconciliation.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');
const dashboardService = require('../src/services/dashboardService');
const leadService = require('../src/services/leadService');
const dealerService = require('../src/services/dealerService');
const commercialVehicleService = require('../src/services/commercialVehicleService');
const locationController = require('../src/controllers/locationController');

async function runTests() {
  console.log('--- STARTING LEADS & DEALER RECONCILIATION TESTS ---');

  const userId = '2281a65e-10bf-473a-ab2e-3902dbf464c8';
  const dealerId = '6c4e44de-2142-442a-aca7-6a41a3454041';

  // 1. Dashboard Reconciliation
  console.log('\n[Test 1] Testing Dashboard Summary...');
  const dash = await dashboardService.getDashboardSummary(userId, 'customer', {});
  console.log('Dashboard seller leads_received:', dash.seller?.leads_received);
  console.log('Dashboard buyer enquiries_sent:', dash.buyer?.enquiries_sent);

  assert.strictEqual(dash.seller?.leads_received?.total, 17, 'Dashboard seller total leads must be 17');
  assert.strictEqual(dash.seller?.leads_received?.active_inventory, 16, 'Dashboard seller active_inventory must be 16');
  assert.strictEqual(dash.seller?.leads_received?.deleted_inventory, 1, 'Dashboard seller deleted_inventory must be 1');
  assert.strictEqual(dash.buyer?.enquiries_sent?.total, 165, 'Dashboard buyer total enquiries must be 165');
  assert.strictEqual(dash.buyer?.enquiries_sent?.active_inventory, 147, 'Dashboard buyer active_inventory must be 147');
  assert.strictEqual(dash.buyer?.enquiries_sent?.deleted_inventory, 18, 'Dashboard buyer deleted_inventory must be 18');
  console.log('✅ Dashboard reconciliation passed.');

  // 2. Lead Summary Reconciliation
  console.log('\n[Test 2] Testing Lead Summary (active vs deleted)...');
  const summaryDefault = await leadService.getLeadSummary(userId, {});
  console.log('Default Lead Summary:', summaryDefault.summary);
  assert.strictEqual(summaryDefault.summary.total_leads, 16, 'Default lead summary total_leads must be 16 (active)');
  assert.strictEqual(summaryDefault.summary.active_inventory, 16, 'Active inventory leads must be 16');
  assert.strictEqual(summaryDefault.summary.deleted_inventory, 1, 'Deleted inventory leads must be 1');
  assert(Array.isArray(summaryDefault.vehicles), 'vehicles array must exist');
  assert(Array.isArray(summaryDefault.cars), 'cars array must exist');

  const summaryWithDeleted = await leadService.getLeadSummary(userId, { include_deleted: 'true' });
  console.log('Lead Summary with include_deleted=true:', summaryWithDeleted.summary);
  assert.strictEqual(summaryWithDeleted.summary.total_leads, 17, 'Lead summary with deleted must be 17');
  assert.strictEqual(summaryWithDeleted.summary.active_inventory, 16);
  assert.strictEqual(summaryWithDeleted.summary.deleted_inventory, 1);

  const summaryOnlyDeleted = await leadService.getLeadSummary(userId, { include_deleted: 'only' });
  console.log('Lead Summary with include_deleted=only:', summaryOnlyDeleted.summary);
  assert.strictEqual(summaryOnlyDeleted.summary.total_leads, 1, 'Lead summary only deleted must be 1');
  console.log('✅ Lead Summary reconciliation passed.');

  // 3. Seller Leads API Reconciliation
  console.log('\n[Test 3] Testing Seller Leads API...');
  const sellerAll = await leadService.getSellerLeads(userId, {}, 1, 20);
  console.log('Seller Leads (all):', sellerAll.summary);
  assert.strictEqual(sellerAll.summary.total, 17, 'Seller leads all total must be 17');
  assert.strictEqual(sellerAll.summary.active_inventory, 16);
  assert.strictEqual(sellerAll.summary.deleted_inventory, 1);
  assert(sellerAll.leads.length > 0);
  assert('is_vehicle_deleted' in sellerAll.leads[0], 'Each lead must have is_vehicle_deleted flag');

  const sellerActiveOnly = await leadService.getSellerLeads(userId, { include_deleted: 'false' }, 1, 20);
  console.log('Seller Leads (active only):', sellerActiveOnly.summary);
  assert.strictEqual(sellerActiveOnly.summary.total, 16, 'Seller leads active only must be 16');

  const sellerDeletedOnly = await leadService.getSellerLeads(userId, { include_deleted: 'only' }, 1, 20);
  console.log('Seller Leads (deleted only):', sellerDeletedOnly.summary);
  assert.strictEqual(sellerDeletedOnly.summary.total, 1, 'Seller leads deleted only must be 1');
  console.log('✅ Seller Leads API reconciliation passed.');

  // 4. Buyer Leads API Reconciliation
  console.log('\n[Test 4] Testing Buyer Leads API...');
  const buyerAll = await leadService.getBuyerLeads(userId, {}, 1, 20);
  console.log('Buyer Leads (all):', buyerAll.summary);
  assert.strictEqual(buyerAll.summary.total, 165, 'Buyer leads all total must be 165');
  assert.strictEqual(buyerAll.summary.active_inventory, 147);
  assert.strictEqual(buyerAll.summary.deleted_inventory, 18);

  const buyerActiveOnly = await leadService.getBuyerLeads(userId, { include_deleted: 'false' }, 1, 20);
  console.log('Buyer Leads (active only):', buyerActiveOnly.summary);
  assert.strictEqual(buyerActiveOnly.summary.total, 147, 'Buyer leads active only must be 147');

  const buyerDeletedOnly = await leadService.getBuyerLeads(userId, { include_deleted: 'only' }, 1, 20);
  console.log('Buyer Leads (deleted only):', buyerDeletedOnly.summary);
  assert.strictEqual(buyerDeletedOnly.summary.total, 18, 'Buyer leads deleted only must be 18');
  console.log('✅ Buyer Leads API reconciliation passed.');

  // 5. Dealer Inventory Contract Parity
  console.log('\n[Test 5] Testing Dealer Inventory Contract Parity (/cars vs /commercial)...');
  const reqCars = { params: { dealerId }, query: { page: '1', limit: '5' } };
  let carsResponseData = null;
  const resCars = {
    status: (code) => {
      assert.strictEqual(code, 200);
      return resCars;
    },
    json: (body) => {
      carsResponseData = body.data;
    },
  };
  await locationController.getDealerCars(reqCars, resCars, (err) => { if (err) throw err; });

  assert(carsResponseData !== null, 'Cars response data must not be null');
  assert(Array.isArray(carsResponseData.vehicles), 'data.vehicles must exist on /cars');
  assert(Array.isArray(carsResponseData.cars), 'data.cars must exist on /cars');
  assert(Array.isArray(carsResponseData.commercial), 'data.commercial must exist on /cars');
  assert.strictEqual(typeof carsResponseData.total, 'number', 'top-level total must exist');
  assert.strictEqual(typeof carsResponseData.page, 'number', 'top-level page must exist');
  assert.strictEqual(typeof carsResponseData.limit, 'number', 'top-level limit must exist');
  assert.strictEqual(typeof carsResponseData.totalPages, 'number', 'top-level totalPages must exist');
  assert(carsResponseData.pagination, 'data.pagination must exist');
  assert.strictEqual(typeof carsResponseData.pagination.total, 'number');
  assert.strictEqual(typeof carsResponseData.pagination.totalPages, 'number');
  assert(carsResponseData.showroom_location, 'showroom_location must exist on /cars');
  assert(carsResponseData.vehicles[0].listing_location, 'listing_location must exist on vehicle cards');
  console.log('Cars endpoint contract verified. Vehicles count:', carsResponseData.vehicles.length);

  const reqComm = { params: { dealerId }, query: { page: '1', limit: '5' } };
  let commResponseData = null;
  const resComm = {
    status: (code) => {
      assert.strictEqual(code, 200);
      return resComm;
    },
    json: (body) => {
      commResponseData = body.data;
    },
  };
  await locationController.getDealerCommercialVehicles(reqComm, resComm, (err) => { if (err) throw err; });

  assert(commResponseData !== null, 'Commercial response data must not be null');
  assert(Array.isArray(commResponseData.vehicles), 'data.vehicles must exist on /commercial');
  assert(Array.isArray(commResponseData.cars), 'data.cars must exist on /commercial');
  assert(Array.isArray(commResponseData.commercial), 'data.commercial must exist on /commercial');
  assert.strictEqual(typeof commResponseData.total, 'number', 'top-level total must exist');
  assert.strictEqual(typeof commResponseData.page, 'number', 'top-level page must exist');
  assert.strictEqual(typeof commResponseData.limit, 'number', 'top-level limit must exist');
  assert.strictEqual(typeof commResponseData.totalPages, 'number', 'top-level totalPages must exist');
  assert(commResponseData.pagination, 'data.pagination must exist on /commercial');
  assert(commResponseData.showroom_location, 'showroom_location must exist on /commercial');
  console.log('Commercial endpoint contract verified. Pagination:', commResponseData.pagination);
  console.log('✅ Dealer Inventory Contract Parity passed.');

  // 6. Dealer Location Hierarchy & State Filter
  console.log('\n[Test 6] Testing Dealer Location Hierarchy & State Filter...');
  const reqDealers = { query: { state_id: '4a4dc0af-2705-4561-9dde-288a9abc306a', limit: '10' } };
  let dealersResponseData = null;
  const resDealers = {
    json: (body) => {
      dealersResponseData = body.data;
    },
  };
  await locationController.getDealersByLocation(reqDealers, resDealers, (err) => { if (err) throw err; });
  assert(Array.isArray(dealersResponseData) && dealersResponseData.length > 0, 'Dealers in state must be returned');
  assert(dealersResponseData[0].showroom_location, 'Dealer must have showroom_location');
  console.log('Sample dealer showroom location:', dealersResponseData[0].showroom_location);
  console.log('✅ Dealer Location Hierarchy passed.');

  console.log('\n🎉 ALL RECONCILIATION TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
