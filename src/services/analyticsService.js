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
    let redisSuccess = false;
    if (redisClient.isOpen) {
      try {
        const bufferKey = `counter:buffer:${carId}:${type}`;
        await redisClient.incr(bufferKey);
        await redisClient.expire(bufferKey, 7 * 24 * 3600); // 7-day safety TTL
        await redisClient.sAdd('dirty:car_metrics', `${carId}:${type}`);
        redisSuccess = true;
      } catch (redisErr) {
        logger.warn(`Redis buffer incr failed, falling back to direct DB: ${redisErr.message}`);
      }
    }

    if (!redisSuccess) {
      // Direct DB fallback if Redis is unavailable or threw quota/connection error
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
 * Decrement a customer interaction (e.g. wishlist removal)
 * Enforces floor guard (never negative)
 */
exports.decrementInteraction = async ({ carId, type = 'wishlist' }) => {
  if (!carId || !VALID_INTERACTION_TYPES.includes(type)) return;

  try {
    let redisSuccess = false;
    if (redisClient.isOpen) {
      try {
        const bufferKey = `counter:buffer:${carId}:${type}`;
        await redisClient.decr(bufferKey);
        await redisClient.expire(bufferKey, 7 * 24 * 3600);
        await redisClient.sAdd('dirty:car_metrics', `${carId}:${type}`);
        redisSuccess = true;
      } catch (redisErr) {
        logger.warn(`Redis buffer decr failed, falling back to direct DB: ${redisErr.message}`);
      }
    }

    if (!redisSuccess) {
      const col = COLUMN_MAP[type];
      if (col) {
        await sequelize.query(
          `INSERT INTO car_stats (car_id, ${col}, created_at, updated_at) 
           VALUES (:carId, 0, NOW(), NOW()) 
           ON DUPLICATE KEY UPDATE ${col} = GREATEST(CAST(${col} AS SIGNED) - 1, 0), updated_at = NOW()`,
          { replacements: { carId } }
        );
      }
    }
  } catch (err) {
    logger.error(`decrementInteraction error for car ${carId}: ${err.message}`);
  }
};

/**
 * Ensure car_stats row exists for a car (self-healing backfill-on-read)
 */
exports.ensureCarStats = async (carId) => {
  if (!carId) return null;

  try {
    let stat = await CarStat.findOne({ where: { car_id: carId } });
    if (stat) return stat;

    // Self-heal: Compute from live tables and insert
    const { View, Wishlist, Lead } = require('../models');
    const [viewsCount, wishlistCount, leadStats] = await Promise.all([
      View.count({ where: { car_id: carId } }),
      Wishlist.count({ where: { car_id: carId } }),
      Lead.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'call' THEN 1 ELSE 0 END")), 'calls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'whatsapp' THEN 1 ELSE 0 END")), 'whatsapp'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) IN ('message', 'chat') THEN 1 ELSE 0 END")), 'messages'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) NOT IN ('call', 'whatsapp', 'message', 'chat') THEN 1 ELSE 0 END")), 'enquiries'],
        ],
        where: { car_id: carId },
        raw: true,
      }),
    ]);

    const l = leadStats[0] || {};
    const calls = parseInt(l.calls, 10) || 0;
    const whatsapp = parseInt(l.whatsapp, 10) || 0;
    const messages = parseInt(l.messages, 10) || 0;
    const enquiries = parseInt(l.enquiries, 10) || 0;

    stat = await CarStat.create({
      car_id: carId,
      views_count: viewsCount,
      wishlist_count: wishlistCount,
      calls_count: calls,
      whatsapp_count: whatsapp,
      messages_count: messages,
      enquiries_count: enquiries,
    });

    return stat;
  } catch (err) {
    logger.error(`ensureCarStats error for car ${carId}: ${err.message}`);
    return null;
  }
};

/**
 * Reconcile car_stats for one, many, or all cars against live truth tables
 */
exports.reconcileCarStats = async (carIds = null) => {
  const whereClause = carIds ? { id: carIds } : {};
  const { Car } = require('../models');
  const cars = await Car.findAll({ where: whereClause, attributes: ['id'], raw: true });

  const results = {
    total: cars.length,
    updated: 0,
    drifts: [],
  };

  for (const car of cars) {
    const cId = car.id;
    const { View, Wishlist, Lead } = require('../models');
    const [liveViews, liveWishlist, leadStats, currentStat] = await Promise.all([
      View.count({ where: { car_id: cId } }),
      Wishlist.count({ where: { car_id: cId } }),
      Lead.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'call' THEN 1 ELSE 0 END")), 'calls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'whatsapp' THEN 1 ELSE 0 END")), 'whatsapp'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) IN ('message', 'chat') THEN 1 ELSE 0 END")), 'messages'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) NOT IN ('call', 'whatsapp', 'message', 'chat') THEN 1 ELSE 0 END")), 'enquiries'],
        ],
        where: { car_id: cId },
        raw: true,
      }),
      CarStat.findOne({ where: { car_id: cId } }),
    ]);

    const l = leadStats[0] || {};
    const liveCalls = parseInt(l.calls, 10) || 0;
    const liveWhatsapp = parseInt(l.whatsapp, 10) || 0;
    const liveMessages = parseInt(l.messages, 10) || 0;
    const liveEnquiries = parseInt(l.enquiries, 10) || 0;

    const current = currentStat || {
      views_count: 0,
      wishlist_count: 0,
      calls_count: 0,
      whatsapp_count: 0,
      messages_count: 0,
      enquiries_count: 0,
    };

    const hasDrift =
      current.views_count !== liveViews ||
      current.wishlist_count !== liveWishlist ||
      current.calls_count !== liveCalls ||
      current.whatsapp_count !== liveWhatsapp ||
      current.messages_count !== liveMessages ||
      current.enquiries_count !== liveEnquiries ||
      !currentStat;

    if (hasDrift) {
      results.drifts.push({
        car_id: cId,
        before: currentStat ? {
          views: current.views_count,
          wishlists: current.wishlist_count,
          calls: current.calls_count,
          whatsapp: current.whatsapp_count,
          messages: current.messages_count,
          enquiries: current.enquiries_count,
        } : 'MISSING',
        after: {
          views: liveViews,
          wishlists: liveWishlist,
          calls: liveCalls,
          whatsapp: liveWhatsapp,
          messages: liveMessages,
          enquiries: liveEnquiries,
        },
      });

      await sequelize.query(
        `INSERT INTO car_stats (
          car_id, views_count, calls_count, whatsapp_count, messages_count, enquiries_count, wishlist_count, created_at, updated_at
        ) VALUES (
          :carId, :views, :calls, :whatsapp, :messages, :enquiries, :wishlist, NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
          views_count = VALUES(views_count),
          calls_count = VALUES(calls_count),
          whatsapp_count = VALUES(whatsapp_count),
          messages_count = VALUES(messages_count),
          enquiries_count = VALUES(enquiries_count),
          wishlist_count = VALUES(wishlist_count),
          updated_at = NOW()`,
        {
          replacements: {
            carId: cId,
            views: liveViews,
            calls: liveCalls,
            whatsapp: liveWhatsapp,
            messages: liveMessages,
            enquiries: liveEnquiries,
            wishlist: liveWishlist,
          },
        }
      );
      results.updated++;
    }
  }

  return results;
};

/**
 * High-Scale Multi-Row Bulk Flusher with Atomic Staging
 * Eliminates race condition data loss by staging dirty keys before processing.
 */
exports.flushMetricsToDb = async () => {
  if (!redisClient.isOpen) return;

  try {
    const activeKey = 'dirty:car_metrics';
    const processingKey = 'dirty:car_metrics:processing';

    // 1. If a prior batch is still in processing, resume it.
    const hasProcessing = await redisClient.exists(processingKey);

    if (!hasProcessing) {
      const hasActive = await redisClient.exists(activeKey);
      if (!hasActive) return;

      try {
        await redisClient.rename(activeKey, processingKey);
      } catch (renameErr) {
        return;
      }
    }

    const dirtyItems = await redisClient.sMembers(processingKey);
    if (!dirtyItems || dirtyItems.length === 0) {
      await redisClient.del(processingKey).catch(() => {});
      return;
    }

    // 2. Aggregate counts by carId in memory
    const aggregatedByCar = {};

    for (const item of dirtyItems) {
      const parts = item.split(':');
      if (parts.length < 2) continue;
      const carId = parts[0];
      const type = parts[1];

      const bufferKey = `counter:buffer:${carId}:${type}`;
      const countStr = await redisClient.getSet(bufferKey, '0');
      const incrementBy = parseInt(countStr) || 0;

      if (incrementBy !== 0) {
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

    // 3. If there are pending adjustments, perform the atomic bulk UPSERT in MySQL with floor guards
    if (carIds.length > 0) {
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
          `(:${pCarId}, GREATEST(:${pViews}, 0), GREATEST(:${pCalls}, 0), GREATEST(:${pWa}, 0), GREATEST(:${pMsg}, 0), GREATEST(:${pEnq}, 0), GREATEST(:${pWish}, 0), NOW(), NOW())`
        );
      });

      const bulkSql = `
        INSERT INTO car_stats (
          car_id, views_count, calls_count, whatsapp_count, messages_count, enquiries_count, wishlist_count, created_at, updated_at
        )
        VALUES ${valuePlaceholders.join(', ')}
        ON DUPLICATE KEY UPDATE
          views_count = GREATEST(CAST(views_count AS SIGNED) + VALUES(views_count), 0),
          calls_count = GREATEST(CAST(calls_count AS SIGNED) + VALUES(calls_count), 0),
          whatsapp_count = GREATEST(CAST(whatsapp_count AS SIGNED) + VALUES(whatsapp_count), 0),
          messages_count = GREATEST(CAST(messages_count AS SIGNED) + VALUES(messages_count), 0),
          enquiries_count = GREATEST(CAST(enquiries_count AS SIGNED) + VALUES(enquiries_count), 0),
          wishlist_count = GREATEST(CAST(wishlist_count AS SIGNED) + VALUES(wishlist_count), 0),
          updated_at = NOW();
      `;

      await sequelize.query(bulkSql, { replacements });
      logger.info(`⚡ Successfully flushed live metrics for ${carIds.length} cars in a single bulk query.`);
    }

    // 4. Delete processing staging key ONLY AFTER successful database persistence
    await redisClient.del(processingKey);

  } catch (err) {
    logger.error(`flushMetricsToDb error: ${err.message}`);
  }
};
