// tests/leads-target-type-filtering.test.js
process.env.NODE_ENV = 'test';

const tests = [];
const describe = (name, fn) => { console.log(name); fn(); };
const it = (name, fn) => { tests.push({ name, fn }); };

const assert = require('assert');
// Load models first so database.js polyfills Sequelize.Op
const { Lead } = require('../src/models');
const { Op } = require('sequelize');
const leadController = require('../src/controllers/leadController');
const leadService = require('../src/services/leadService');

describe('Leads Target Type Filtering & Controller Extraction Tests', () => {
  it('1. leadController.getSellerLeads extracts target_type and passes to leadService', async () => {
    let capturedSellerId = null;
    let capturedFilters = null;
    let capturedPage = null;
    let capturedLimit = null;

    const originalGetSellerLeads = leadService.getSellerLeads;
    leadService.getSellerLeads = async (sellerId, filters, page, limit) => {
      capturedSellerId = sellerId;
      capturedFilters = filters;
      capturedPage = page;
      capturedLimit = limit;
      return { leads: [], pagination: {} };
    };

    try {
      const req = {
        user: { id: 'seller-uuid-123', role: 'dealer' },
        query: { target_type: 'commercial', page: '2', limit: '10' },
      };
      let sentData = null;
      const res = {
        status: (code) => {
          assert.strictEqual(code, 200);
          return res;
        },
        json: (payload) => {
          sentData = payload;
        },
      };

      await leadController.getSellerLeads(req, res);

      assert.strictEqual(capturedSellerId, 'seller-uuid-123');
      assert.strictEqual(capturedFilters.target_type, 'commercial');
      assert.strictEqual(capturedPage, '2');
      assert.strictEqual(capturedLimit, '10');
      assert.strictEqual(sentData.status, 'success');
    } finally {
      leadService.getSellerLeads = originalGetSellerLeads;
    }
  });

  it('2. leadController.getSellerLeads supports targetType and type query param aliases', async () => {
    let capturedFilters = null;
    const originalGetSellerLeads = leadService.getSellerLeads;
    leadService.getSellerLeads = async (sellerId, filters) => {
      capturedFilters = filters;
      return { leads: [] };
    };

    try {
      const req = {
        user: { id: 'seller-uuid-123' },
        query: { type: 'commercial' },
      };
      const res = { status: () => res, json: () => {} };
      await leadController.getSellerLeads(req, res);
      assert.strictEqual(capturedFilters.target_type, 'commercial');

      const req2 = {
        user: { id: 'seller-uuid-123' },
        query: { targetType: 'commercial' },
      };
      await leadController.getSellerLeads(req2, res);
      assert.strictEqual(capturedFilters.target_type, 'commercial');
    } finally {
      leadService.getSellerLeads = originalGetSellerLeads;
    }
  });

  it('3. leadController.getBuyerLeads extracts target_type and passes to leadService', async () => {
    let capturedBuyerId = null;
    let capturedFilters = null;
    const originalGetBuyerLeads = leadService.getBuyerLeads;
    leadService.getBuyerLeads = async (buyerId, filters) => {
      capturedBuyerId = buyerId;
      capturedFilters = filters;
      return { leads: [] };
    };

    try {
      const req = {
        user: { id: 'buyer-uuid-456' },
        query: { target_type: 'commercial' },
      };
      const res = { status: () => res, json: () => {} };
      await leadController.getBuyerLeads(req, res);

      assert.strictEqual(capturedBuyerId, 'buyer-uuid-456');
      assert.strictEqual(capturedFilters.target_type, 'commercial');
    } finally {
      leadService.getBuyerLeads = originalGetBuyerLeads;
    }
  });

  it('4. leadController.getLeadSummary forwards target_type', async () => {
    let capturedOptions = null;
    const originalGetLeadSummary = leadService.getLeadSummary;
    leadService.getLeadSummary = async (sellerId, opts) => {
      capturedOptions = opts;
      return { total: 0, vehicles: [] };
    };

    try {
      const req = {
        user: { id: 'seller-uuid-123' },
        query: { target_type: 'commercial' },
      };
      const res = { status: () => res, json: () => {} };
      await leadController.getLeadSummary(req, res);

      assert.strictEqual(capturedOptions.target_type, 'commercial');
    } finally {
      leadService.getLeadSummary = originalGetLeadSummary;
    }
  });

  it('5. leadService.getSellerLeads builds correct WHERE clause for commercial and car', async () => {
    let capturedOptions = null;
    const originalFindAndCountAll = Lead.findAndCountAll;
    Lead.findAndCountAll = async (opts) => {
      capturedOptions = opts;
      return { count: 0, rows: [] };
    };

    try {
      // 5a. Query target_type = commercial
      await leadService.getSellerLeads('seller-1', { target_type: 'commercial' }, 1, 20);
      assert.strictEqual(capturedOptions.where.seller_id, 'seller-1');
      assert.strictEqual(capturedOptions.where.target_type, 'commercial');

      // 5b. Query target_type = car (should use Op.or with null fallback for backward compatibility)
      await leadService.getSellerLeads('seller-1', { target_type: 'car' }, 1, 20);
      assert.strictEqual(capturedOptions.where.seller_id, 'seller-1');
      assert(Array.isArray(capturedOptions.where[Op.or]), 'should have Op.or array for car');
      assert.deepStrictEqual(capturedOptions.where[Op.or], [{ target_type: 'car' }, { target_type: null }]);

      // 5c. Query target_type = all (should NOT restrict target_type)
      await leadService.getSellerLeads('seller-1', { target_type: 'all' }, 1, 20);
      assert.strictEqual(capturedOptions.where.seller_id, 'seller-1');
      assert.strictEqual(capturedOptions.where.target_type, undefined);
      assert.strictEqual(capturedOptions.where[Op.or], undefined);
    } finally {
      Lead.findAndCountAll = originalFindAndCountAll;
    }
  });

  it('6. leadService.getBuyerLeads builds correct WHERE clause for commercial and car', async () => {
    let capturedOptions = null;
    const originalFindAndCountAll = Lead.findAndCountAll;
    Lead.findAndCountAll = async (opts) => {
      capturedOptions = opts;
      return { count: 0, rows: [] };
    };

    try {
      // 6a. Query target_type = commercial
      await leadService.getBuyerLeads('buyer-1', { target_type: 'commercial' }, 1, 20);
      assert.strictEqual(capturedOptions.where.buyer_id, 'buyer-1');
      assert.strictEqual(capturedOptions.where.target_type, 'commercial');

      // 6b. Query target_type = car
      await leadService.getBuyerLeads('buyer-1', { target_type: 'car' }, 1, 20);
      assert.strictEqual(capturedOptions.where.buyer_id, 'buyer-1');
      assert.deepStrictEqual(capturedOptions.where[Op.or], [{ target_type: 'car' }, { target_type: null }]);
    } finally {
      Lead.findAndCountAll = originalFindAndCountAll;
    }
  });

  it('7. leadService.getAllLeadsForAdmin builds polymorphic vehicle & target_type filters', async () => {
    let capturedOptions = null;
    const originalFindAndCountAll = Lead.findAndCountAll;
    Lead.findAndCountAll = async (opts) => {
      capturedOptions = opts;
      return { count: 0, rows: [] };
    };

    try {
      // 7a. Query target_type = commercial and target_id
      await leadService.getAllLeadsForAdmin({ target_type: 'commercial', target_id: 'comm-uuid-777' });
      assert.strictEqual(capturedOptions.where.target_type, 'commercial');
      assert.deepStrictEqual(capturedOptions.where[Op.or], [
        { car_id: 'comm-uuid-777' },
        { target_id: 'comm-uuid-777' },
      ]);

      // 7b. Check that includes contain commercialVehicle
      const includeAliases = capturedOptions.include.map(inc => inc.as);
      assert(includeAliases.includes('commercialVehicle'), 'admin query must include commercialVehicle');
      assert(includeAliases.includes('car'), 'admin query must include car');
    } finally {
      Lead.findAndCountAll = originalFindAndCountAll;
    }
  });
});

(async () => {
  for (const t of tests) {
    await t.fn();
    console.log('  ✓ ' + t.name);
  }
  console.log('\nAll 7 tests passed successfully!');
})().catch((err) => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
