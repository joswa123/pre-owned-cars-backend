const { Car, Lead, Requirement } = require('../models');
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

  // 2. Role-based lead ownership mapping
  // Dealers care about leads they received (seller_id)
  // Customers care about enquiries they sent (buyer_id)
  const leadWhere = role === 'dealer'
    ? { seller_id: userId }
    : { buyer_id: userId };

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
  const [carCounts, leadCounts, requirementCounts] = await Promise.all([
    // Cars by status (unscoped to correctly capture active, sold, and deleted statuses)
    Car.unscoped().findAll({
      where: { user_id: userId },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
    // Leads by source
    Lead.findAll({
      where: leadWhere,
      attributes: ['source', [sequelize.fn('COUNT', sequelize.col('source')), 'count']],
      group: ['source'],
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
    leads: {
      total: 0,
      by_source: {
        whatsapp: 0,
        call: 0,
        message: 0,
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
      // Other non-deleted statuses if any (e.g. pending, inactive)
      result.cars.total += count;
    }
  });

  // 7. Populate Lead Counts
  leadCounts.forEach((row) => {
    const source = row.source || 'message';
    const count = parseInt(row.count, 10) || 0;
    result.leads.total += count;
    result.leads.by_source[source] = count;
  });

  // 8. Populate Requirement Counts (Total excludes soft-deleted records)
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

  // 9. Cache in Redis
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
