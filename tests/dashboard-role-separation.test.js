// tests/dashboard-role-separation.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');

function buildDashboardSummary({
  carCounts = [],
  commercialCounts = [],
  sellerLeadCounts = [],
  buyerEnquiryCounts = [],
  requirementCounts = [],
  options = {},
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

  const carCategory = {
    seller: {
      inventory: sellerInventory.cars,
      leads_received: {
        total: 0,
        by_source: { whatsapp: 0, call: 0, message: 0 },
      },
    },
    buyer: {
      requirements: { total: 0, active: 0, expired: 0, bought: 0, deleted: 0 },
      enquiries_sent: { total: 0, by_source: { whatsapp: 0, call: 0, message: 0 } },
    },
  };

  const commercialCategory = {
    seller: {
      inventory: sellerInventory.commercial,
      leads_received: {
        total: 0,
        by_source: { whatsapp: 0, call: 0, message: 0 },
      },
    },
    buyer: {
      requirements: { total: 0, active: 0, expired: 0, bought: 0, deleted: 0 },
      enquiries_sent: { total: 0, by_source: { whatsapp: 0, call: 0, message: 0 } },
    },
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
    if (targetType === 'commercial') {
      sellerLeadsReceived.by_target.commercial += count;
      commercialCategory.seller.leads_received.total += count;
      commercialCategory.seller.leads_received.by_source[source] = (commercialCategory.seller.leads_received.by_source[source] || 0) + count;
    } else {
      sellerLeadsReceived.by_target.car += count;
      carCategory.seller.leads_received.total += count;
      carCategory.seller.leads_received.by_source[source] = (carCategory.seller.leads_received.by_source[source] || 0) + count;
    }
  });

  // Buyer enquiries sent
  buyerEnquiryCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;
    buyerEnquiriesSent.total += count;
    buyerEnquiriesSent.by_source[source] = (buyerEnquiriesSent.by_source[source] || 0) + count;
    if (targetType === 'commercial') {
      buyerEnquiriesSent.by_target.commercial += count;
      commercialCategory.buyer.enquiries_sent.total += count;
      commercialCategory.buyer.enquiries_sent.by_source[source] = (commercialCategory.buyer.enquiries_sent.by_source[source] || 0) + count;
    } else {
      buyerEnquiriesSent.by_target.car += count;
      carCategory.buyer.enquiries_sent.total += count;
      carCategory.buyer.enquiries_sent.by_source[source] = (carCategory.buyer.enquiries_sent.by_source[source] || 0) + count;
    }
  });

  // Buyer requirements
  requirementCounts.forEach((row) => {
    const status = (row.status || 'active').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    const isCommercial = targetType === 'commercial';
    const catReq = isCommercial ? commercialCategory.buyer.requirements : carCategory.buyer.requirements;

    if (status === 'active') {
      buyerRequirements.active += count;
      buyerRequirements.total += count;
      catReq.active += count;
      catReq.total += count;
    } else if (status === 'expired') {
      buyerRequirements.expired += count;
      buyerRequirements.total += count;
      catReq.expired += count;
      catReq.total += count;
    } else if (status === 'bought') {
      buyerRequirements.bought += count;
      buyerRequirements.total += count;
      catReq.bought += count;
      catReq.total += count;
    } else if (status === 'deleted') {
      buyerRequirements.deleted += count;
      catReq.deleted += count;
    }

    if (isCommercial) {
      buyerRequirements.by_target.commercial += count;
    } else {
      buyerRequirements.by_target.car += count;
    }
  });

  const masterResult = {
    categories: {
      car: carCategory,
      commercial: commercialCategory,
    },
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

  const requestedCategory = (options.category || options.target_type || options.type || '').trim().toLowerCase();
  const requestedRole = (options.role || '').trim().toLowerCase();

  if (requestedCategory === 'car') {
    if (requestedRole === 'seller') return { category: 'car', role: 'seller', inventory: carCategory.seller.inventory, leads_received: carCategory.seller.leads_received };
    if (requestedRole === 'buyer') return { category: 'car', role: 'buyer', requirements: carCategory.buyer.requirements, enquiries_sent: carCategory.buyer.enquiries_sent };
    return { category: 'car', ...carCategory };
  }

  if (requestedCategory === 'commercial') {
    if (requestedRole === 'seller') return { category: 'commercial', role: 'seller', inventory: commercialCategory.seller.inventory, leads_received: commercialCategory.seller.leads_received };
    if (requestedRole === 'buyer') return { category: 'commercial', role: 'buyer', requirements: commercialCategory.buyer.requirements, enquiries_sent: commercialCategory.buyer.enquiries_sent };
    return { category: 'commercial', ...commercialCategory };
  }

  if (requestedRole === 'seller') {
    return { role: 'seller', ...masterResult.seller, by_category: { car: carCategory.seller, commercial: commercialCategory.seller } };
  }
  if (requestedRole === 'buyer') {
    return { role: 'buyer', ...masterResult.buyer, by_category: { car: carCategory.buyer, commercial: commercialCategory.buyer } };
  }

  return masterResult;
}

console.log('Running Dashboard Role & Category Separation Tests...');

const params = {
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
    { source: 'whatsapp', target_type: 'commercial', count: '1' },
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
};

// 1. Check Full Master Payload
const full = buildDashboardSummary(params);
assert.strictEqual(full.seller.inventory.cars.total, 6);
assert.strictEqual(full.seller.inventory.commercial.total, 2);
assert.strictEqual(full.seller.inventory.vehicles.total, 8);
assert.strictEqual(full.seller.leads_received.total, 18);
assert.strictEqual(full.seller.leads_received.by_target.car, 17);
assert.strictEqual(full.seller.leads_received.by_target.commercial, 1);

// Categories
assert.strictEqual(full.categories.car.seller.inventory.total, 6);
assert.strictEqual(full.categories.car.seller.leads_received.total, 17);
assert.strictEqual(full.categories.car.buyer.requirements.total, 4);
assert.strictEqual(full.categories.car.buyer.enquiries_sent.total, 1);

assert.strictEqual(full.categories.commercial.seller.inventory.total, 2);
assert.strictEqual(full.categories.commercial.seller.leads_received.total, 1);
assert.strictEqual(full.categories.commercial.buyer.requirements.total, 1);
assert.strictEqual(full.categories.commercial.buyer.enquiries_sent.total, 2);

// 2. Check Filter ?category=car
const carOnly = buildDashboardSummary({ ...params, options: { category: 'car' } });
assert.strictEqual(carOnly.category, 'car');
assert.strictEqual(carOnly.seller.inventory.total, 6);
assert.strictEqual(carOnly.seller.leads_received.total, 17);
assert.strictEqual(carOnly.buyer.requirements.total, 4);
assert.strictEqual(carOnly.buyer.enquiries_sent.total, 1);
assert.strictEqual(carOnly.commercial, undefined);

// 3. Check Filter ?category=commercial
const commOnly = buildDashboardSummary({ ...params, options: { category: 'commercial' } });
assert.strictEqual(commOnly.category, 'commercial');
assert.strictEqual(commOnly.seller.inventory.total, 2);
assert.strictEqual(commOnly.seller.leads_received.total, 1);
assert.strictEqual(commOnly.buyer.requirements.total, 1);
assert.strictEqual(commOnly.buyer.enquiries_sent.total, 2);
assert.strictEqual(commOnly.cars, undefined);

// 4. Check Filter ?role=seller
const sellerOnly = buildDashboardSummary({ ...params, options: { role: 'seller' } });
assert.strictEqual(sellerOnly.role, 'seller');
assert.strictEqual(sellerOnly.inventory.vehicles.total, 8);
assert.strictEqual(sellerOnly.leads_received.total, 18);
assert.strictEqual(sellerOnly.by_category.car.inventory.total, 6);
assert.strictEqual(sellerOnly.by_category.commercial.inventory.total, 2);

// 5. Check Backward Compatibility
assert.strictEqual(full.cars.total, 6);
assert.strictEqual(full.commercial.total, 2);
assert.strictEqual(full.vehicles.total, 8);
assert.strictEqual(full.leads.total, 18);
assert.strictEqual(full.requirements.total, 5);

console.log('  ✓ All Dashboard Role & Category Separation Tests Passed Successfully!');
