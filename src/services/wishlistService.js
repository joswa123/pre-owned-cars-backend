const { Wishlist, Car, CarImage, CommercialVehicle, CommercialVehicleImage, User, District, DealerProfile, Brand, Model, Variant, State, City } = require('../models');
const { resolveTarget } = require('../utils/targetResolver');
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
      for await (const chunk of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        const batch = Array.isArray(chunk) ? chunk : (chunk ? [chunk] : []);
        if (batch.length > 0) {
          await redisClient.del(batch);
        }
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
 * Add an item to wishlist (idempotent, prevents duplicates)
 */
exports.addToWishlist = async (userId, targetId, targetType = 'car') => {
  if (!targetId) throw new AppError('Target ID is required', 400);

  const type = (targetType || 'car').toLowerCase();
  let sellerId = null;

  if (type === 'commercial') {
    const commercial = await CommercialVehicle.findByPk(targetId);
    if (!commercial) throw new AppError('Commercial vehicle not found', 404);
    sellerId = commercial.user_id;

    const [wishlist, created] = await Wishlist.findOrCreate({
      where: { user_id: userId, target_type: 'commercial', target_id: targetId },
      defaults: { user_id: userId, car_id: null, target_type: 'commercial', target_id: targetId },
    });
    if (created) {
      await invalidateWishlistCaches(userId, null, sellerId);
    }
    return wishlist;
  }

  const car = await Car.findByPk(targetId);
  if (!car) throw new AppError('Car not found', 404);
  sellerId = car.user_id;

  const [wishlist, created] = await Wishlist.findOrCreate({
    where: { user_id: userId, car_id: targetId },
    defaults: { user_id: userId, car_id: targetId, target_type: 'car', target_id: targetId },
  });

  if (created) {
    const analyticsService = require('./analyticsService');
    await analyticsService.recordInteraction({ carId: targetId, userId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, targetId, sellerId);
  }

  return wishlist;
};

/**
 * Toggle an item in wishlist (creates if absent, destroys if present)
 */
exports.toggleWishlist = async (userId, targetId, targetType = 'car') => {
  if (!targetId) throw new AppError('Target ID is required', 400);

  const type = (targetType || 'car').toLowerCase();
  let sellerId = null;

  if (type === 'commercial') {
    const commercial = await CommercialVehicle.findByPk(targetId);
    if (!commercial) throw new AppError('Commercial vehicle not found', 404);
    sellerId = commercial.user_id;

    const existing = await Wishlist.findOne({
      where: { user_id: userId, target_type: 'commercial', target_id: targetId },
    });

    if (existing) {
      await existing.destroy();
      await invalidateWishlistCaches(userId, null, sellerId);
      return {
        is_wishlisted: false,
        isWishlist: false,
        message: 'Removed from wishlist',
      };
    } else {
      const wishlist = await Wishlist.create({
        user_id: userId,
        car_id: null,
        target_type: 'commercial',
        target_id: targetId,
      });
      await invalidateWishlistCaches(userId, null, sellerId);
      return {
        is_wishlisted: true,
        isWishlist: true,
        message: 'Added to wishlist',
        data: wishlist,
      };
    }
  }

  const car = await Car.findByPk(targetId);
  if (!car) throw new AppError('Car not found', 404);
  sellerId = car.user_id;

  const existing = await Wishlist.findOne({
    where: { user_id: userId, car_id: targetId },
  });

  if (existing) {
    await existing.destroy();
    const analyticsService = require('./analyticsService');
    await analyticsService.decrementInteraction({ carId: targetId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, targetId, sellerId);
    return {
      is_wishlisted: false,
      isWishlist: false,
      message: 'Removed from wishlist',
    };
  } else {
    const wishlist = await Wishlist.create({
      user_id: userId,
      car_id: targetId,
      target_type: 'car',
      target_id: targetId,
    });
    const analyticsService = require('./analyticsService');
    await analyticsService.recordInteraction({ carId: targetId, userId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, targetId, sellerId);
    return {
      is_wishlisted: true,
      isWishlist: true,
      message: 'Added to wishlist',
      data: wishlist,
    };
  }
};

/**
 * Remove an item from wishlist (idempotent)
 */
exports.removeFromWishlist = async (userId, targetId, targetType = 'car') => {
  if (!targetId) throw new AppError('Target ID is required', 400);

  const type = (targetType || 'car').toLowerCase();
  let where = { user_id: userId };
  if (type === 'commercial') {
    where.target_type = 'commercial';
    where.target_id = targetId;
  } else {
    where = {
      user_id: userId,
      [require('sequelize').Op.or]: [
        { car_id: targetId },
        { target_id: targetId, target_type: 'car' },
      ],
    };
  }

  const deletedCount = await Wishlist.destroy({ where });
  if (deletedCount > 0 && type === 'car') {
    const analyticsService = require('./analyticsService');
    await analyticsService.decrementInteraction({ carId: targetId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, targetId, null);
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
          { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
          { model: District, as: 'district', attributes: ['id', 'name'] },
          { model: City, as: 'city', attributes: ['id', 'name'] },
        ],
      }
    ],
    order: [['created_at', 'DESC']],
  });
  // Extract cars from wishlist entries, safely filtering out nulls for deleted cars
  const { transformCarImages } = require('./carService');
  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  return wishlist
    .map(w => (w.car || w.Car || null))
    .filter(Boolean)
    .map(c => transformCarImages(c, baseUrl));
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