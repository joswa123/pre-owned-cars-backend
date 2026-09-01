const { Highlight } = require('../models');
const redisClient = require('../config/redis');
const { AppError } = require('../utils/errorHandler');

const PUBLIC_CACHE_KEY = 'public:highlights';
const CACHE_TTL = 3600; // 1 hour

/**
 * Helper to invalidate highlights cache
 */
const invalidateHighlightCache = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(PUBLIC_CACHE_KEY);
    }
  } catch (err) {
    console.error('Redis highlight cache invalidation error:', err);
  }

  // Clear HTTP route caches
  try {
    const { clearCache } = require('../middlewares/cacheMiddleware');
    await clearCache('/api/v1/highlights');
    await clearCache('/api/v1/car-highlights');
    await clearCache('/api/v1/cars');
  } catch (err) {
    // Ignore if cache middleware not loaded
  }
};

/**
 * Get all active highlights for public dropdown/selection (Cached)
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
    console.error('Redis get highlight cache error:', err);
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
    console.error('Redis set highlight cache error:', err);
  }

  return highlights;
};

/**
 * Get all highlights for Admin management (No cache, includes inactive)
 */
exports.getAllHighlights = async () => {
  return await Highlight.findAll({
    order: [['created_at', 'DESC'], ['name', 'ASC']],
  });
};

/**
 * Create a new highlight tag (Admin)
 */
exports.createHighlight = async (data) => {
  const existing = await Highlight.findOne({
    where: { name: data.name.trim() },
  });

  if (existing) {
    throw new AppError('A highlight with this name already exists.', 400);
  }

  const highlight = await Highlight.create({
    name: data.name.trim(),
    is_active: data.is_active !== undefined ? data.is_active : true,
  });

  await invalidateHighlightCache();
  return highlight;
};

/**
 * Update an existing highlight tag (Admin)
 */
exports.updateHighlight = async (id, data) => {
  const highlight = await Highlight.findByPk(id);
  if (!highlight) {
    throw new AppError('Highlight not found.', 404);
  }

  if (data.name && data.name.trim() !== highlight.name) {
    const existing = await Highlight.findOne({
      where: { name: data.name.trim() },
    });
    if (existing && existing.id !== id) {
      throw new AppError('A highlight with this name already exists.', 400);
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  await highlight.update(updateData);
  await invalidateHighlightCache();

  return highlight;
};

/**
 * Delete a highlight tag (Admin - Hard delete)
 */
exports.deleteHighlight = async (id) => {
  const highlight = await Highlight.findByPk(id);
  if (!highlight) {
    throw new AppError('Highlight not found.', 404);
  }

  await highlight.destroy();
  await invalidateHighlightCache();

  return true;
};

exports.invalidateHighlightCache = invalidateHighlightCache;
