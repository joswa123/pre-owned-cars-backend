const { Car, Lead, Requirement, CommercialVehicle } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');

const CACHE_TTL = 60; // seconds
const CACHE_KEY_PREFIX = 'dashboard:user:';

/**
 * Get dashboard summary metrics for an authenticated user (customer or dealer)
 * @param {string} userId
 * @param {string} role ('customer' | 'dealer' | 'admin')
 * @returns {Promise<Object>}
 */
exports.getDashboardSummary = async (userId, role) => {
  const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;

  // 1. Read from Redis Cache if available
  if (redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis cache get error in getDashboardSummary:', err);
    }
  }

  // 2. Leads ownership mapping: Dashboard counts leads received on user's vehicle listings (seller_id)
  const leadWhere = { seller_id: userId };

  // 3. Dynamic Expiry: Auto-expire active requirements past expiry date before counting
  try {
    await Requirement.update(
      { status: 'expired' },
      {
        where: {
          user_id: userId,
          status: 'active',
          expiry_date: { [Op.lt]: new Date() },
        },
      }
    );
  } catch (expErr) {
    console.error('Requirement auto-expiry error in getDashboardSummary:', expErr);
  }

  // 4. Parallel aggregated COUNT queries with GROUP BY
  const [
    carCounts,
    commercialCounts,
    sellerLeadCounts,
    buyerEnquiryCounts,
    requirementCounts,
  ] = await Promise.all([
    // Cars by status (unscoped to correctly capture active, sold, and deleted statuses)
    Car.unscoped().findAll({
      where: { user_id: userId },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
    // Commercial vehicles by status
    CommercialVehicle.findAll({
      where: { user_id: userId },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
    // Seller Leads received by source and target_type
    Lead.findAll({
      where: leadWhere,
      attributes: ['source', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source', 'target_type'],
      raw: true,
    }),
    // Buyer Enquiries sent by source and target_type
    Lead.findAll({
      where: { buyer_id: userId },
      attributes: ['source', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source', 'target_type'],
      raw: true,
    }),
    // Requirements by status and target_type
    Requirement.findAll({
      where: { user_id: userId },
      attributes: ['status', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status', 'target_type'],
      raw: true,
    }),
  ]);

  // 5. Build clean, role-separated entities
  const sellerInventory = {
    cars: {
      total: 0,
      active: 0,
      sold: 0,
      deleted: 0,
    },
    commercial: {
      total: 0,
      active: 0,
      sold: 0,
      deleted: 0,
      expired: 0,
    },
    vehicles: {
      total: 0,
      active: 0,
      sold: 0,
      deleted: 0,
      expired: 0,
    },
  };

  const sellerLeadsReceived = {
    total: 0,
    by_source: {
      whatsapp: 0,
      call: 0,
      message: 0,
    },
    by_target: {
      car: 0,
      commercial: 0,
    },
  };

  const buyerRequirements = {
    total: 0,
    active: 0,
    expired: 0,
    bought: 0,
    deleted: 0,
    by_target: {
      car: 0,
      commercial: 0,
    },
  };

  const buyerEnquiriesSent = {
    total: 0,
    by_source: {
      whatsapp: 0,
      call: 0,
      message: 0,
    },
    by_target: {
      car: 0,
      commercial: 0,
    },
  };

  // 6. Populate Car Counts (Total excludes soft-deleted records)
  carCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      sellerInventory.cars.active = count;
      sellerInventory.cars.total += count;
    } else if (status === 'sold') {
      sellerInventory.cars.sold = count;
      sellerInventory.cars.total += count;
    } else if (status === 'deleted') {
      sellerInventory.cars.deleted = count;
    } else {
      sellerInventory.cars.total += count;
    }
  });

  // 7. Populate Commercial Vehicle Counts (Total excludes soft-deleted records)
  commercialCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      sellerInventory.commercial.active = count;
      sellerInventory.commercial.total += count;
    } else if (status === 'sold') {
      sellerInventory.commercial.sold = count;
      sellerInventory.commercial.total += count;
    } else if (status === 'expired') {
      sellerInventory.commercial.expired = count;
      sellerInventory.commercial.total += count;
    } else if (status === 'deleted') {
      sellerInventory.commercial.deleted = count;
    } else {
      sellerInventory.commercial.total += count;
    }
  });

  // 8. Populate Unified Vehicles Object (sums up statuses across both sources)
  sellerInventory.vehicles.active = sellerInventory.cars.active + sellerInventory.commercial.active;
  sellerInventory.vehicles.sold = sellerInventory.cars.sold + sellerInventory.commercial.sold;
  sellerInventory.vehicles.deleted = sellerInventory.cars.deleted + sellerInventory.commercial.deleted;
  sellerInventory.vehicles.expired = (sellerInventory.cars.expired || 0) + sellerInventory.commercial.expired;
  sellerInventory.vehicles.total = sellerInventory.cars.total + sellerInventory.commercial.total;

  // 9. Populate Seller Lead Counts (leads received by seller on their listings)
  sellerLeadCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    sellerLeadsReceived.total += count;

    if (sellerLeadsReceived.by_source[source] !== undefined) {
      sellerLeadsReceived.by_source[source] += count;
    } else {
      sellerLeadsReceived.by_source[source] = count;
    }

    if (targetType === 'commercial') {
      sellerLeadsReceived.by_target.commercial += count;
    } else {
      sellerLeadsReceived.by_target.car += count;
    }
  });

  // 10. Populate Buyer Enquiry Counts (enquiries sent by user to other sellers)
  buyerEnquiryCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    buyerEnquiriesSent.total += count;

    if (buyerEnquiriesSent.by_source[source] !== undefined) {
      buyerEnquiriesSent.by_source[source] += count;
    } else {
      buyerEnquiriesSent.by_source[source] = count;
    }

    if (targetType === 'commercial') {
      buyerEnquiriesSent.by_target.commercial += count;
    } else {
      buyerEnquiriesSent.by_target.car += count;
    }
  });

  // 11. Populate Requirement Counts (buying requirements posted by user)
  requirementCounts.forEach((row) => {
    const status = row.status;
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    if (status === 'active') {
      buyerRequirements.active += count;
      buyerRequirements.total += count;
    } else if (status === 'expired') {
      buyerRequirements.expired += count;
      buyerRequirements.total += count;
    } else if (status === 'bought') {
      buyerRequirements.bought += count;
      buyerRequirements.total += count;
    } else if (status === 'deleted') {
      buyerRequirements.deleted += count;
    }

    if (targetType === 'commercial') {
      buyerRequirements.by_target.commercial += count;
    } else {
      buyerRequirements.by_target.car += count;
    }
  });

  // 12. Final Result with clean Role-Separated Sections + 100% Backward Compatibility
  const result = {
    // ──────── SELLER / DEALER PERSPECTIVE ────────
    seller: {
      inventory: sellerInventory,
      leads_received: sellerLeadsReceived,
    },

    // ──────── BUYER / CUSTOMER PERSPECTIVE ────────
    buyer: {
      requirements: buyerRequirements,
      enquiries_sent: buyerEnquiriesSent,
    },

    // ──────── BACKWARD COMPATIBILITY (Existing Screens) ────────
    cars: sellerInventory.cars,
    commercial: sellerInventory.commercial,
    vehicles: sellerInventory.vehicles,
    leads: sellerLeadsReceived,
    requirements: buyerRequirements,
  };

  // 11. Cache in Redis
  if (redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (err) {
      console.error('Redis cache set error in getDashboardSummary:', err);
    }
  }

  return result;
};

/**
 * Invalidate dashboard cache for a user
 * @param {string} userId
 */
exports.invalidateDashboardCache = async (userId) => {
  if (!userId) return;
  const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
  try {
    if (redisClient.isOpen) {
      await redisClient.del(cacheKey);
    }
  } catch (err) {
    console.error('Redis invalidate error in invalidateDashboardCache:', err);
  }
};
