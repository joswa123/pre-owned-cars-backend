const { Wishlist, Car, CarImage, User, District, DealerProfile, Brand, Model, Variant, State, City } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');
const redisClient = require('../config/redis');

const clearCache = async (key) => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.error('Redis clear cache error in wishlistService:', err);
  }
};

const clearCacheByPattern = async (pattern) => {
  try {
    if (redisClient.isOpen) {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (err) {
    console.error(`Redis clear cache pattern error for ${pattern}:`, err);
  }
};

const invalidateWishlistCaches = async (userId, carId, sellerId = null) => {
  try {
    const dashboardService = require('./dashboardService');
    if (userId) await dashboardService.invalidateDashboardCache(userId);
    if (sellerId) await dashboardService.invalidateDashboardCache(sellerId);

    if (carId) {
      await clearCache(`car:${carId}`);
      await clearCacheByPattern('cars:list:*');
      const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
      await clearHttpCache(`/api/v1/cars/${carId}`);
      await clearHttpCache('/api/v1/cars');
      await clearHttpCache('/api/v1/wishlist');
    }
  } catch (e) {
    console.error('Wishlist cache invalidation error:', e);
  }
};

const encodeCursor = (cursorObj) => {
  if (!cursorObj || !cursorObj.created_at) return null;
  return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
};

const decodeCursor = (cursorStr) => {
  if (!cursorStr) return null;
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.created_at) {
      return parsed;
    }
  } catch (e) {
    const d = new Date(cursorStr);
    if (!isNaN(d.getTime())) {
      return { created_at: d.toISOString(), id: null };
    }
  }
  return null;
};

/**
 * Add a car to wishlist (idempotent, prevents duplicates)
 */
exports.addToWishlist = async (userId, carId) => {
  if (!carId) throw new AppError('Car ID is required', 400);

  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found', 404);

  const [wishlist, created] = await Wishlist.findOrCreate({
    where: { user_id: userId, car_id: carId },
    defaults: { user_id: userId, car_id: carId },
  });

  if (created) {
    const analyticsService = require('./analyticsService');
    await analyticsService.recordInteraction({ carId, userId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, carId, car.user_id);
  }

  return wishlist;
};

/**
 * Toggle a car in wishlist (creates if absent, destroys if present)
 */
exports.toggleWishlist = async (userId, carId) => {
  if (!carId) throw new AppError('Car ID is required', 400);

  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found', 404);

  const existing = await Wishlist.findOne({
    where: { user_id: userId, car_id: carId },
  });

  if (existing) {
    await existing.destroy();
    await invalidateWishlistCaches(userId, carId, car.user_id);
    return {
      is_wishlisted: false,
      isWishlist: false,
      message: 'Removed from wishlist',
    };
  } else {
    const wishlist = await Wishlist.create({ user_id: userId, car_id: carId });
    const analyticsService = require('./analyticsService');
    await analyticsService.recordInteraction({ carId, userId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, carId, car.user_id);
    return {
      is_wishlisted: true,
      isWishlist: true,
      message: 'Added to wishlist',
      data: wishlist,
    };
  }
};

/**
 * Remove a car from wishlist (idempotent)
 */
exports.removeFromWishlist = async (userId, carId) => {
  if (!carId) throw new AppError('Car ID is required', 400);

  const car = await Car.findByPk(carId);
  const deletedCount = await Wishlist.destroy({ where: { user_id: userId, car_id: carId } });
  if (deletedCount > 0) {
    await invalidateWishlistCaches(userId, carId, car?.user_id);
  }
  return { success: true, message: 'Removed from wishlist' };
};

/**
 * Get user's wishlist with car details
 */
exports.getWishlist = async (userId) => {
  const wishlist = await Wishlist.findAll({
    where: { user_id: userId },
    include: [
      {
        model: Car,
        as: 'car',
        include: [
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
          {
            model: User,
            as: 'seller',
            attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
            include: [
              { model: District, as: 'district', attributes: ['name'] },
              { model: DealerProfile, as: 'dealerProfile', attributes: ['company_name'] },
            ],
          },
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: State, as: 'state', attributes: ['id', 'name'] },
          { model: District, as: 'district', attributes: ['id', 'name'] },
          { model: City, as: 'city', attributes: ['id', 'name'] },
        ],
      }
    ],
    order: [['created_at', 'DESC']],
  });
  // Extract cars from wishlist entries, safely filtering out nulls for deleted cars
  return wishlist
    .map(w => (w.car || w.Car || null))
    .filter(Boolean);
};

/**
 * Get users who wishlisted a specific car (seller authorization check)
 */
exports.getCarWishlists = async (sellerId, carId, { limit = 20, cursor = null } = {}) => {
  // 1. Security Check: Verify car exists and belongs to this seller
  const car = await Car.findOne({
    where: { id: carId, user_id: sellerId },
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });

  if (!car) {
    throw new AppError('Car not found or you are not authorized to view these metrics', 404);
  }

  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const cacheKey = `car:wishlists:${carId}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getCarWishlists:', err);
  }

  const whereClause = {
    car_id: carId,
  };

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    if (decodedCursor.id) {
      whereClause[Op.or] = [
        { created_at: { [Op.lt]: new Date(decodedCursor.created_at) } },
        {
          created_at: new Date(decodedCursor.created_at),
          id: { [Op.lt]: decodedCursor.id },
        },
      ];
    } else {
      whereClause.created_at = { [Op.lt]: new Date(decodedCursor.created_at) };
    }
  }

  const wishlists = await Wishlist.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'phone'],
      },
    ],
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limitNum,
  });

  const formattedWishlists = wishlists.map((w) => {
    const json = typeof w.toJSON === 'function' ? w.toJSON() : w;
    return {
      user_name: json.user?.full_name || 'Anonymous',
      user_phone: json.user?.phone || 'N/A',
      wishlisted_at: json.created_at,
    };
  });

  const lastItem = wishlists.length > 0 ? wishlists[wishlists.length - 1] : null;
  const nextCursor = lastItem
    ? encodeCursor({ created_at: lastItem.created_at, id: lastItem.id })
    : null;

  const carName = [car.brand?.name, car.carModel?.name].filter(Boolean).join(' ') || 'Pre-Owned Car';

  const result = {
    car_info: {
      id: car.id,
      name: carName,
      number_plate: car.number_plate,
    },
    wishlists: formattedWishlists,
    pagination: {
      limit: limitNum,
      next_cursor: nextCursor,
      has_more: formattedWishlists.length === limitNum,
    },
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 30, JSON.stringify(result));
    }
  } catch (err) {
    console.error('Redis set cache error in getCarWishlists:', err);
  }

  return result;
};