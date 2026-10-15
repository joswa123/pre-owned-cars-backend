'use strict';

const { Highlight, CarHighlight } = require('../models');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const redisClient = require('../config/redis');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { clearCachePattern } = require('./carService');

const PUBLIC_CACHE_KEY = 'public:highlights';
const CACHE_TTL = 3600; // 1 hour

/**
 * Normalize highlight name: trim and collapse multiple internal whitespaces
 */
const normalizeName = (name) => {
  return name ? String(name).trim().replace(/\s+/g, ' ') : '';
};

/**
 * Helper to invalidate highlights cache
 * @param {'create' | 'rename' | 'toggle' | 'delete'} scope
 */
const invalidateHighlightCache = async (scope = 'create') => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(PUBLIC_CACHE_KEY);
    }
  } catch (err) {
    logger.error(`Redis highlight cache invalidation error: ${err.message}`);
  }

  // Clear HTTP route caches for highlights
  try {
    const { clearCache } = require('../middlewares/cacheMiddleware');
    await clearCache('/api/v1/highlights');
    await clearCache('/api/v1/car-highlights');
    await clearCache('/api/highlights');
    await clearCache('/api/car-highlights');

    // On rename or delete: also invalidate car HTTP route caches
    if (scope === 'rename' || scope === 'delete') {
      await clearCache('/api/v1/cars');
      await clearCache('/api/cars');
    }
  } catch (err) {
    logger.warn(`Route cache clear warning: ${err.message}`);
  }

  // On rename or delete: also invalidate service-level car cache keys (cars:list:* and car:*)
  if (scope === 'rename' || scope === 'delete') {
    try {
      if (typeof clearCachePattern === 'function') {
        await clearCachePattern('cars:list:*');
        await clearCachePattern('car:*');
      }
    } catch (err) {
      logger.error(`Error clearing cars:list:* pattern cache: ${err.message}`);
    }
  }
};

/**
 * 1. Get all active highlights for public dropdown/selection (Cached)
 */
exports.getActiveHighlights = async () => {
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(PUBLIC_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    logger.error(`Redis get highlight cache error: ${err.message}`);
  }

  const highlights = await Highlight.findAll({
    where: { is_active: true },
    attributes: ['id', 'name', 'is_active', 'created_at'],
    order: [['name', 'ASC']],
  });

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(PUBLIC_CACHE_KEY, CACHE_TTL, JSON.stringify(highlights));
    }
  } catch (err) {
    logger.error(`Redis set highlight cache error: ${err.message}`);
  }

  return highlights;
};

/**
 * 2. Get all highlights for Admin management (includes cars_count and inactive)
 */
exports.getAllHighlights = async () => {
  const highlights = await Highlight.findAll({
    attributes: [
      'id',
      'name',
      'is_active',
      'created_at',
      'updated_at',
      [
        sequelize.literal(`(
          SELECT COUNT(DISTINCT ch.car_id)
          FROM car_highlights ch
          INNER JOIN cars c ON c.id = ch.car_id AND (c.deleted_at IS NULL AND c.status != 'deleted')
          WHERE ch.highlight_id = Highlight.id
        )`),
        'cars_count',
      ],
    ],
    order: [['created_at', 'DESC'], ['name', 'ASC']],
  });

  return highlights.map((h) => {
    const json = typeof h.toJSON === 'function' ? h.toJSON() : { ...h };
    json.cars_count = parseInt(json.cars_count || 0, 10);
    return json;
  });
};

/**
 * 3. Get single highlight by ID (Admin)
 */
exports.getHighlightById = async (id) => {
  const highlight = await Highlight.findByPk(id, {
    attributes: [
      'id',
      'name',
      'is_active',
      'created_at',
      'updated_at',
      [
        sequelize.literal(`(
          SELECT COUNT(DISTINCT ch.car_id)
          FROM car_highlights ch
          INNER JOIN cars c ON c.id = ch.car_id AND (c.deleted_at IS NULL AND c.status != 'deleted')
          WHERE ch.highlight_id = Highlight.id
        )`),
        'cars_count',
      ],
    ],
  });

  if (!highlight) {
    throw new AppError('Highlight not found.', 404);
  }

  const json = typeof highlight.toJSON === 'function' ? highlight.toJSON() : { ...highlight };
  json.cars_count = parseInt(json.cars_count || 0, 10);
  return json;
};

/**
 * 4. Create a new highlight tag (Admin)
 */
exports.createHighlight = async (data, adminUser = null) => {
  const cleanName = normalizeName(data.name);

  if (!cleanName) {
    throw new AppError('Highlight name is required.', 400);
  }
  if (cleanName.length > 100) {
    throw new AppError('Highlight name cannot exceed 100 characters.', 400);
  }

  // Case-insensitive duplicate check
  const existing = await Highlight.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      cleanName.toLowerCase()
    ),
  });

  if (existing) {
    throw new AppError('A highlight with this name already exists.', 409);
  }

  const highlight = await Highlight.create({
    name: cleanName,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
  });

  await invalidateHighlightCache('create');

  logger.info(`[Admin Audit] Created highlight ${highlight.id} ("${highlight.name}") by admin ${adminUser?.id || 'system'}`);

  const json = typeof highlight.toJSON === 'function' ? highlight.toJSON() : { ...highlight };
  json.cars_count = 0;
  return json;
};

/**
 * 5. Update an existing highlight tag (Admin)
 */
exports.updateHighlight = async (id, data, adminUser = null) => {
  const highlight = await Highlight.findByPk(id);
  if (!highlight) {
    throw new AppError('Highlight not found.', 404);
  }

  let scope = 'toggle';
  const updateData = {};

  if (data.name !== undefined) {
    const cleanName = normalizeName(data.name);
    if (!cleanName) {
      throw new AppError('Highlight name cannot be empty.', 400);
    }
    if (cleanName.length > 100) {
      throw new AppError('Highlight name cannot exceed 100 characters.', 400);
    }

    if (cleanName.toLowerCase() !== highlight.name.toLowerCase()) {
      // Case-insensitive duplicate check excluding current ID
      const existing = await Highlight.findOne({
        where: {
          [Op.and]: [
            sequelize.where(
              sequelize.fn('LOWER', sequelize.col('name')),
              cleanName.toLowerCase()
            ),
            { id: { [Op.ne]: id } },
          ],
        },
      });

      if (existing) {
        throw new AppError('A highlight with this name already exists.', 409);
      }
    }

    if (cleanName !== highlight.name) {
      updateData.name = cleanName;
      scope = 'rename';
    }
  }

  if (data.is_active !== undefined) {
    updateData.is_active = Boolean(data.is_active);
  }

  if (Object.keys(updateData).length > 0) {
    await highlight.update(updateData);
    await invalidateHighlightCache(scope);
    logger.info(`[Admin Audit] Updated highlight ${id} (scope: ${scope}) by admin ${adminUser?.id || 'system'}`);
  }

  return await exports.getHighlightById(id);
};

/**
 * 6. Patch highlight status (Admin - only is_active)
 */
exports.patchHighlight = async (id, data, adminUser = null) => {
  return await exports.updateHighlight(id, { is_active: data.is_active }, adminUser);
};

/**
 * 7. Delete a highlight tag (Admin)
 */
exports.deleteHighlight = async (id, force = false, adminUser = null) => {
  const highlight = await Highlight.findByPk(id);
  if (!highlight) {
    throw new AppError('Highlight not found.', 404);
  }

  // Count distinct non-deleted cars referencing this highlight
  const [result] = await sequelize.query(
    `SELECT COUNT(DISTINCT ch.car_id) as count
     FROM car_highlights ch
     INNER JOIN cars c ON c.id = ch.car_id AND (c.deleted_at IS NULL AND c.status != 'deleted')
     WHERE ch.highlight_id = :highlightId`,
    {
      replacements: { highlightId: id },
      type: sequelize.QueryTypes.SELECT,
    }
  );
  const carsCount = parseInt(result?.count || 0, 10);

  if (carsCount > 0 && !force) {
    throw new AppError(
      `Cannot delete: highlight is used by ${carsCount} cars. Deactivate it or unassign first.`,
      409
    );
  }

  if (carsCount > 0 && force) {
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'super_admin')) {
      throw new AppError('Admin permission required to force delete highlights.', 403);
    }

    const transaction = await sequelize.transaction();
    try {
      const lockedHighlight = await Highlight.findByPk(id, { transaction });
      if (!lockedHighlight) {
        await transaction.rollback();
        throw new AppError('Highlight not found.', 404);
      }

      // Explicitly delete junction entries first
      await CarHighlight.destroy({
        where: { highlight_id: id },
        transaction,
      });

      // Delete the highlight row itself (never touches cars table)
      await lockedHighlight.destroy({ transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    logger.info(`[Admin Audit] Highlight ${id} ("${highlight.name}") force-deleted by admin ${adminUser.id} (${carsCount} cars unlinked)`);
    await invalidateHighlightCache('delete');
    return {
      success: true,
      message: `Highlight force-deleted successfully. Unlinked from ${carsCount} car(s).`,
    };
  }

  // When carsCount === 0: Safe direct delete
  await highlight.destroy();
  logger.info(`[Admin Audit] Highlight ${id} ("${highlight.name}") deleted by admin ${adminUser?.id || 'system'}`);
  await invalidateHighlightCache('delete');

  return {
    success: true,
    message: 'Highlight deleted successfully.',
  };
};

exports.invalidateHighlightCache = invalidateHighlightCache;
