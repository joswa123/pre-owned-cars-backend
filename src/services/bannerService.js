const { Banner } = require('../models');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');

const PUBLIC_CACHE_KEY = 'public:banners';
const CACHE_TTL = 300; // 5 minutes

/**
 * Invalidate public banners cache
 */
const invalidateCache = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(PUBLIC_CACHE_KEY);
    }
  } catch (err) {
    console.error('Redis cache invalidation error:', err);
  }
};

/**
 * Get active banners for public display (Cached)
 */
exports.getActiveBanners = async () => {
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(PUBLIC_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis cache get error:', err);
  }

  const banners = await Banner.findAll({
    where: { is_active: true },
    order: [['order', 'ASC'], ['created_at', 'DESC']],
    attributes: ['id', 'image_url', 'link_url', 'title', 'order'],
  });

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(PUBLIC_CACHE_KEY, CACHE_TTL, JSON.stringify(banners));
    }
  } catch (err) {
    console.error('Redis cache set error:', err);
  }

  return banners;
};

/**
 * Get all banners for admin list
 */
exports.getAllBanners = async () => {
  return await Banner.findAll({
    order: [['order', 'ASC'], ['created_at', 'DESC']],
  });
};

/**
 * Create a new banner
 */
exports.createBanner = async (data, imageUrl) => {
  if (data.order === undefined || data.order === null) {
    const lastBanner = await Banner.findOne({ order: [['order', 'DESC']] });
    data.order = lastBanner ? lastBanner.order + 1 : 0;
  }

  const banner = await Banner.create({
    ...data,
    image_url: imageUrl,
  });

  await invalidateCache();
  return banner;
};

/**
 * Update an existing banner
 */
exports.updateBanner = async (id, data, imageUrl) => {
  const banner = await Banner.findByPk(id);
  if (!banner) throw new Error('Banner not found');

  const updateData = { ...data };
  if (imageUrl) {
    updateData.image_url = imageUrl;
  }

  await banner.update(updateData);
  await invalidateCache();
  return banner;
};

/**
 * Delete a banner (Hard delete)
 */
exports.deleteBanner = async (id) => {
  const banner = await Banner.findByPk(id);
  if (!banner) throw new Error('Banner not found');

  await banner.destroy();
  await invalidateCache();
  return true;
};

/**
 * Reorder banners in bulk
 */
exports.reorderBanners = async (orders) => {
  const ids = orders.map(o => o.id);
  const existing = await Banner.findAll({ where: { id: ids } });
  
  if (existing.length !== ids.length) {
    throw new Error('Some banner IDs are invalid.');
  }

  const t = await sequelize.transaction();
  try {
    for (const item of orders) {
      await Banner.update(
        { order: item.order },
        { where: { id: item.id }, transaction: t }
      );
    }
    await t.commit();
    await invalidateCache();
    return true;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};
