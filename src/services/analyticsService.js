const { CarInteraction, CarStat } = require('../models');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const VALID_INTERACTION_TYPES = ['view', 'call', 'whatsapp', 'message', 'enquiry', 'wishlist'];
const COLUMN_MAP = {
  view: 'views_count',
  call: 'calls_count',
  whatsapp: 'whatsapp_count',
  message: 'messages_count',
  enquiry: 'enquiries_count',
  wishlist: 'wishlist_count',
};

/**
 * Record a customer interaction atomically in Redis and queue for batch persistence
 * @param {Object} params
 * @param {string} params.carId
 * @param {string} [params.userId]
 * @param {string} params.type ('view' | 'call' | 'whatsapp' | 'message' | 'enquiry' | 'wishlist')
 * @param {string} [params.ipAddress]
 */
exports.recordInteraction = async ({ carId, userId = null, type = 'view', ipAddress = null }) => {
  if (!carId || !VALID_INTERACTION_TYPES.includes(type)) return;

  try {
    // 1. Anti-spam / Bot rate limiter per IP per car (e.g. max 30 per min)
    if (ipAddress && redisClient.isOpen) {
      const rateLimitKey = `rate:interact:${ipAddress}:${carId}:${type}`;
      const currentCount = await redisClient.incr(rateLimitKey);
      if (currentCount === 1) {
        await redisClient.expire(rateLimitKey, 60); // 60s window
      } else if (currentCount > 30) {
        // Skip duplicate burst increments from bots/fast-clicks
        return;
      }
    }

    // 2. Atomic Redis buffer increment
    if (redisClient.isOpen) {
      const bufferKey = `counter:buffer:${carId}:${type}`;
      await redisClient.incr(bufferKey);
      await redisClient.expire(bufferKey, 7 * 24 * 3600); // 7-day safety TTL
      await redisClient.sAdd('dirty:car_metrics', `${carId}:${type}`);
    } else {
      // Direct DB fallback if Redis is unavailable
      const col = COLUMN_MAP[type];
      if (col) {
        await sequelize.query(
          `INSERT INTO car_stats (car_id, ${col}, created_at, updated_at) 
           VALUES (:carId, 1, NOW(), NOW()) 
           ON DUPLICATE KEY UPDATE ${col} = ${col} + 1, updated_at = NOW()`,
          { replacements: { carId } }
        );
      }
    }

    // 3. Asynchronously record in master event log (fire-and-forget)
    CarInteraction.create({
      car_id: carId,
      user_id: userId || null,
      type,
      ip_address: ipAddress || null,
    }).catch(err => {
      logger.error(`CarInteraction event log error: ${err.message}`);
    });

  } catch (err) {
    logger.error(`recordInteraction error for car ${carId}: ${err.message}`);
  }
};

/**
 * High-Scale Multi-Row Bulk Flusher (Runs periodically, e.g. every 60s)
 * Aggregates all dirty metrics into a single multi-row UPSERT query.
 */
exports.flushMetricsToDb = async () => {
  if (!redisClient.isOpen) return;

  try {
    const dirtyItems = await redisClient.sMembers('dirty:car_metrics');
    if (!dirtyItems || dirtyItems.length === 0) return;

    // Clear dirty set atomically
    await redisClient.del('dirty:car_metrics');

    // Aggregate counts by carId in memory before hitting DB
    const aggregatedByCar = {};

    for (const item of dirtyItems) {
      const parts = item.split(':');
      if (parts.length < 2) continue;
      const carId = parts[0];
      const type = parts[1];

      const bufferKey = `counter:buffer:${carId}:${type}`;
      const countStr = await redisClient.getSet(bufferKey, '0');
      const incrementBy = parseInt(countStr) || 0;

      if (incrementBy > 0) {
        if (!aggregatedByCar[carId]) {
          aggregatedByCar[carId] = {
            view: 0,
            call: 0,
            whatsapp: 0,
            message: 0,
            enquiry: 0,
            wishlist: 0,
          };
        }
        aggregatedByCar[carId][type] = (aggregatedByCar[carId][type] || 0) + incrementBy;
      }
    }

    const carIds = Object.keys(aggregatedByCar);
    if (carIds.length === 0) return;

    // Construct multi-row bulk INSERT ... ON DUPLICATE KEY UPDATE query
    const valuePlaceholders = [];
    const replacements = {};

    carIds.forEach((cId, idx) => {
      const metrics = aggregatedByCar[cId];
      const pCarId = `carId_${idx}`;
      const pViews = `views_${idx}`;
      const pCalls = `calls_${idx}`;
      const pWa = `wa_${idx}`;
      const pMsg = `msg_${idx}`;
      const pEnq = `enq_${idx}`;
      const pWish = `wish_${idx}`;

      replacements[pCarId] = cId;
      replacements[pViews] = metrics.view || 0;
      replacements[pCalls] = metrics.call || 0;
      replacements[pWa] = metrics.whatsapp || 0;
      replacements[pMsg] = metrics.message || 0;
      replacements[pEnq] = metrics.enquiry || 0;
      replacements[pWish] = metrics.wishlist || 0;

      valuePlaceholders.push(
        `(:${pCarId}, :${pViews}, :${pCalls}, :${pWa}, :${pMsg}, :${pEnq}, :${pWish}, NOW(), NOW())`
      );
    });

    const bulkSql = `
      INSERT INTO car_stats (
        car_id, views_count, calls_count, whatsapp_count, messages_count, enquiries_count, wishlist_count, created_at, updated_at
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON DUPLICATE KEY UPDATE
        views_count = views_count + VALUES(views_count),
        calls_count = calls_count + VALUES(calls_count),
        whatsapp_count = whatsapp_count + VALUES(whatsapp_count),
        messages_count = messages_count + VALUES(messages_count),
        enquiries_count = enquiries_count + VALUES(enquiries_count),
        wishlist_count = wishlist_count + VALUES(wishlist_count),
        updated_at = NOW();
    `;

    await sequelize.query(bulkSql, { replacements });
    logger.info(`⚡ Successfully flushed live metrics for ${carIds.length} cars in a single bulk query.`);

  } catch (err) {
    logger.error(`flushMetricsToDb error: ${err.message}`);
  }
};
