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
  const [carCounts, commercialCounts, leadCounts, requirementCounts] = await Promise.all([
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
    // Leads by source and target_type
    Lead.findAll({
      where: leadWhere,
      attributes: ['source', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source', 'target_type'],
      raw: true,
    }),
    // Requirements by status
    Requirement.findAll({
      where: { user_id: userId },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
  ]);

  // 5. Default zeroed structure (prevents null values for new users)
  const result = {
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
    leads: {
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
    },
    requirements: {
      total: 0,
      active: 0,
      expired: 0,
      bought: 0,
      deleted: 0,
    },
  };

  // 6. Populate Car Counts (Total excludes soft-deleted records)
  carCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      result.cars.active = count;
      result.cars.total += count;
    } else if (status === 'sold') {
      result.cars.sold = count;
      result.cars.total += count;
    } else if (status === 'deleted') {
      result.cars.deleted = count;
    } else {
      result.cars.total += count;
    }
  });

  // 7. Populate Commercial Vehicle Counts (Total excludes soft-deleted records)
  commercialCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      result.commercial.active = count;
      result.commercial.total += count;
    } else if (status === 'sold') {
      result.commercial.sold = count;
      result.commercial.total += count;
    } else if (status === 'expired') {
      result.commercial.expired = count;
      result.commercial.total += count;
    } else if (status === 'deleted') {
      result.commercial.deleted = count;
    } else {
      result.commercial.total += count;
    }
  });

  // 8. Populate Unified Vehicles Object (sums up statuses across both sources)
  result.vehicles.active = result.cars.active + result.commercial.active;
  result.vehicles.sold = result.cars.sold + result.commercial.sold;
  result.vehicles.deleted = result.cars.deleted + result.commercial.deleted;
  result.vehicles.expired = (result.cars.expired || 0) + result.commercial.expired;
  result.vehicles.total = result.cars.total + result.commercial.total;

  // 9. Populate Lead Counts (by source & by target)
  leadCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    result.leads.total += count;

    if (result.leads.by_source[source] !== undefined) {
      result.leads.by_source[source] += count;
    } else {
      result.leads.by_source[source] = count;
    }

    if (targetType === 'commercial') {
      result.leads.by_target.commercial += count;
    } else {
      result.leads.by_target.car += count;
    }
  });

  // 10. Populate Requirement Counts (Total excludes soft-deleted records)
  requirementCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      result.requirements.active = count;
      result.requirements.total += count;
    } else if (status === 'expired') {
      result.requirements.expired = count;
      result.requirements.total += count;
    } else if (status === 'bought') {
      result.requirements.bought = count;
      result.requirements.total += count;
    } else if (status === 'deleted') {
      result.requirements.deleted = count;
    }
  });

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
