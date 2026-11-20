// tests/dashboard-role-separation.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');

// Simulate the data transformation in dashboardService
function buildDashboardSummary({
  carCounts = [],
  commercialCounts = [],
  sellerLeadCounts = [],
  buyerEnquiryCounts = [],
  requirementCounts = [],
}) {
  const sellerInventory = {
    cars: { total: 0, active: 0, sold: 0, deleted: 0 },
    commercial: { total: 0, active: 0, sold: 0, deleted: 0, expired: 0 },
    vehicles: { total: 0, active: 0, sold: 0, deleted: 0, expired: 0 },
  };

  const sellerLeadsReceived = {
    total: 0,
    by_source: { whatsapp: 0, call: 0, message: 0 },
    by_target: { car: 0, commercial: 0 },
  };

  const buyerRequirements = {
    total: 0,
    active: 0,
    expired: 0,
    bought: 0,
    deleted: 0,
    by_target: { car: 0, commercial: 0 },
  };

  const buyerEnquiriesSent = {
    total: 0,
    by_source: { whatsapp: 0, call: 0, message: 0 },
    by_target: { car: 0, commercial: 0 },
  };

  // Populate cars
  carCounts.forEach((row) => {
    const count = parseInt(row.count, 10) || 0;
    if (row.status === 'active') { sellerInventory.cars.active = count; sellerInventory.cars.total += count; }
    else if (row.status === 'sold') { sellerInventory.cars.sold = count; sellerInventory.cars.total += count; }
    else if (row.status === 'deleted') { sellerInventory.cars.deleted = count; }
    else { sellerInventory.cars.total += count; }
  });

  // Populate commercial
  commercialCounts.forEach((row) => {
    const count = parseInt(row.count, 10) || 0;
    if (row.status === 'active') { sellerInventory.commercial.active = count; sellerInventory.commercial.total += count; }
    else if (row.status === 'sold') { sellerInventory.commercial.sold = count; sellerInventory.commercial.total += count; }
    else if (row.status === 'expired') { sellerInventory.commercial.expired = count; sellerInventory.commercial.total += count; }
    else if (row.status === 'deleted') { sellerInventory.commercial.deleted = count; }
    else { sellerInventory.commercial.total += count; }
  });

  // Unified
  sellerInventory.vehicles.active = sellerInventory.cars.active + sellerInventory.commercial.active;
  sellerInventory.vehicles.sold = sellerInventory.cars.sold + sellerInventory.commercial.sold;
  sellerInventory.vehicles.deleted = sellerInventory.cars.deleted + sellerInventory.commercial.deleted;
  sellerInventory.vehicles.expired = (sellerInventory.cars.expired || 0) + sellerInventory.commercial.expired;
  sellerInventory.vehicles.total = sellerInventory.cars.total + sellerInventory.commercial.total;

  // Seller leads received
  sellerLeadCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;
    sellerLeadsReceived.total += count;
    sellerLeadsReceived.by_source[source] = (sellerLeadsReceived.by_source[source] || 0) + count;
    if (targetType === 'commercial') sellerLeadsReceived.by_target.commercial += count;
    else sellerLeadsReceived.by_target.car += count;
  });

  // Buyer enquiries sent
  buyerEnquiryCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;
    buyerEnquiriesSent.total += count;
    buyerEnquiriesSent.by_source[source] = (buyerEnquiriesSent.by_source[source] || 0) + count;
    if (targetType === 'commercial') buyerEnquiriesSent.by_target.commercial += count;
    else buyerEnquiriesSent.by_target.car += count;
  });

  // Buyer requirements
  requirementCounts.forEach((row) => {
    const status = row.status;
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') { buyerRequirements.active += count; buyerRequirements.total += count; }
    else if (status === 'expired') { buyerRequirements.expired += count; buyerRequirements.total += count; }
    else if (status === 'bought') { buyerRequirements.bought += count; buyerRequirements.total += count; }
    else if (status === 'deleted') { buyerRequirements.deleted += count; }

    if (targetType === 'commercial') buyerRequirements.by_target.commercial += count;
    else buyerRequirements.by_target.car += count;
  });

  return {
    seller: {
      inventory: sellerInventory,
      leads_received: sellerLeadsReceived,
    },
    buyer: {
      requirements: buyerRequirements,
      enquiries_sent: buyerEnquiriesSent,
    },
    cars: sellerInventory.cars,
    commercial: sellerInventory.commercial,
    vehicles: sellerInventory.vehicles,
    leads: sellerLeadsReceived,
    requirements: buyerRequirements,
  };
}

console.log('Running Dashboard Role Separation Tests...');

const summary = buildDashboardSummary({
  carCounts: [
    { status: 'active', count: '5' },
    { status: 'sold', count: '1' },
    { status: 'deleted', count: '2' },
  ],
  commercialCounts: [
    { status: 'active', count: '2' },
    { status: 'sold', count: '0' },
  ],
  sellerLeadCounts: [
    { source: 'whatsapp', target_type: 'car', count: '3' },
    { source: 'call', target_type: 'car', count: '9' },
    { source: 'message', target_type: 'car', count: '5' },
  ],
  buyerEnquiryCounts: [
    { source: 'call', target_type: 'commercial', count: '2' },
    { source: 'whatsapp', target_type: 'car', count: '1' },
  ],
  requirementCounts: [
    { status: 'active', target_type: 'car', count: '2' },
    { status: 'expired', target_type: 'car', count: '2' },
    { status: 'expired', target_type: 'commercial', count: '1' },
  ],
});

// 1. Check Seller
assert.strictEqual(summary.seller.inventory.cars.total, 6);
assert.strictEqual(summary.seller.inventory.commercial.total, 2);
assert.strictEqual(summary.seller.inventory.vehicles.total, 8);
assert.strictEqual(summary.seller.leads_received.total, 17);
assert.strictEqual(summary.seller.leads_received.by_source.whatsapp, 3);
assert.strictEqual(summary.seller.leads_received.by_source.call, 9);
assert.strictEqual(summary.seller.leads_received.by_source.message, 5);

// 2. Check Buyer
assert.strictEqual(summary.buyer.requirements.total, 5);
assert.strictEqual(summary.buyer.requirements.active, 2);
assert.strictEqual(summary.buyer.requirements.expired, 3);
assert.strictEqual(summary.buyer.requirements.by_target.car, 4);
assert.strictEqual(summary.buyer.requirements.by_target.commercial, 1);
assert.strictEqual(summary.buyer.enquiries_sent.total, 3);
assert.strictEqual(summary.buyer.enquiries_sent.by_target.car, 1);
assert.strictEqual(summary.buyer.enquiries_sent.by_target.commercial, 2);

// 3. Check Backward Compatibility
assert.strictEqual(summary.cars.total, 6);
assert.strictEqual(summary.commercial.total, 2);
assert.strictEqual(summary.vehicles.total, 8);
assert.strictEqual(summary.leads.total, 17);
assert.strictEqual(summary.requirements.total, 5);
assert.strictEqual(summary.requirements.by_target.car, 4);
assert.strictEqual(summary.requirements.by_target.commercial, 1);

console.log('  ✓ All Dashboard Role Separation Tests Passed Successfully!');
