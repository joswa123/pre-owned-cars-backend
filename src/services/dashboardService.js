const { Car, Lead, Requirement } = require('../models');
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

  // 3. Parallel aggregated COUNT queries with GROUP BY
  const [carCounts, leadCounts, requirementCounts] = await Promise.all([
    // Cars by status
    Car.findAll({
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

  // 4. Default zeroed structure (prevents null values for new users)
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

  // 5. Populate Car Counts
  carCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    result.cars.total += count;
    if (status === 'active') result.cars.active = count;
    else if (status === 'sold') result.cars.sold = count;
    else if (status === 'deleted') result.cars.deleted = count;
  });

  // 6. Populate Lead Counts
  leadCounts.forEach((row) => {
    const source = row.source || 'message';
    const count = parseInt(row.count, 10) || 0;
    result.leads.total += count;
    if (result.leads.by_source.hasOwnProperty(source)) {
      result.leads.by_source[source] = count;
    } else {
      result.leads.by_source[source] = count;
    }
  });

  // 7. Populate Requirement Counts
  requirementCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    result.requirements.total += count;
    if (status === 'active') result.requirements.active = count;
    else if (status === 'expired') result.requirements.expired = count;
    else if (status === 'bought') result.requirements.bought = count;
    else if (status === 'deleted') result.requirements.deleted = count;
  });

  // 8. Cache in Redis
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
