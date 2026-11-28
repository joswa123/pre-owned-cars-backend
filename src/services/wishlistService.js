const {
  Wishlist,
  Car,
  CarImage,
  CommercialVehicle,
  CommercialVehicleImage,
  Bike,
  BikeImage,
  User,
  District,
  DealerProfile,
  Brand,
  Model,
  Variant,
  CarType,
  State,
  City,
} = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
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
        const batch = Array.isArray(chunk) ? chunk.filter(Boolean) : (chunk ? [chunk] : []);
        if (batch.length > 0) {
          await redisClient.del(batch);
        }
      }
    }
  } catch (err) {
    console.error(`Redis clear cache pattern error for ${pattern}:`, err);
  }
};

const invalidateWishlistCaches = async (userId, targetId, sellerId = null, targetType = 'car') => {
  try {
    const type = String(targetType || 'car').toLowerCase();
    const dashboardService = require('./dashboardService');
    if (userId) await dashboardService.invalidateDashboardCache(userId);
    if (sellerId) await dashboardService.invalidateDashboardCache(sellerId);

    const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
    await clearHttpCache('/api/v1/wishlist');
    if (userId) {
      await clearCacheByPattern(`user:wishlist:${userId}:*`);
    }

    if (targetId) {
      if (type === 'commercial') {
        await clearCache(`commercial:${targetId}`);
        await clearCacheByPattern('commercial:*');
        await clearCacheByPattern(`commercial:wishlists:${targetId}:*`);
        await clearCacheByPattern('similar:commercial:*');
        await clearCacheByPattern('recommended:commercial:*');
        await clearCacheByPattern('seller:commercial:*');
        await clearCacheByPattern('seller:*');
        await clearCacheByPattern('dealer:*');
        await clearCacheByPattern('global_search:*');
        await clearHttpCache(`/api/v1/commercial/${targetId}`);
        await clearHttpCache('/api/v1/commercial');
        await clearHttpCache('/api/commercial');
        await clearHttpCache('/api/v1/search');
      } else if (type === 'bike') {
        await clearCache(`bike:${targetId}`);
        await clearCacheByPattern('bike:*');
        await clearCacheByPattern('bikes:*');
        await clearCacheByPattern(`bike:wishlists:${targetId}:*`);
        await clearCacheByPattern('similar:bike:*');
        await clearCacheByPattern('recommended:bike:*');
        await clearCacheByPattern('seller:*');
        await clearCacheByPattern('dealer:*');
        await clearCacheByPattern('global_search:*');
        await clearHttpCache(`/api/v1/bikes/${targetId}`);
        await clearHttpCache('/api/v1/bikes');
        await clearHttpCache('/api/bikes');
        await clearHttpCache('/api/v1/search');
      } else {
        await clearCache(`car:${targetId}`);
        await clearCacheByPattern('cars:*');
        await clearCacheByPattern(`car:wishlists:${targetId}:*`);
        await clearCacheByPattern('similar:*');
        await clearCacheByPattern('recommended:*');
        await clearCacheByPattern('seller:*');
        await clearCacheByPattern('catalog:*');
        await clearCacheByPattern('dealer:*');
        await clearHttpCache(`/api/v1/cars/${targetId}`);
        await clearHttpCache('/api/v1/cars');
        await clearHttpCache('/api/v1/catalog');
        await clearHttpCache('/api/v1/dealers');
      }
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

const maskPhone = (phone) => {
  if (!phone) return 'N/A';
  const str = String(phone).trim();
  if (!str) return 'N/A';
  if (str.length <= 4) return '******';
  return '*'.repeat(str.length - 4) + str.slice(-4);
};

const normalizeTargetType = (targetType = 'car') => {
  const type = String(targetType || 'car').trim().toLowerCase();
  if (!['car', 'commercial', 'bike'].includes(type)) {
    throw new AppError('target_type must be one of: car, commercial, bike', 400);
  }
  return type;
};

const resolveVehicleType = async (targetId, explicitType = null) => {
  if (explicitType) {
    const normalized = normalizeTargetType(explicitType);
    if (normalized === 'car' && targetId) {
      const carExists = await Car.findByPk(targetId, { attributes: ['id'] });
      if (!carExists) {
        const commExists = await CommercialVehicle.findByPk(targetId, { attributes: ['id'] });
        if (commExists) return 'commercial';
        const bikeExists = await Bike.findByPk(targetId, { attributes: ['id'] });
        if (bikeExists) return 'bike';
      }
    }
    return normalized;
  }
  if (targetId) {
    const commercial = await CommercialVehicle.findByPk(targetId, { attributes: ['id'] });
    if (commercial) return 'commercial';
    const bike = await Bike.findByPk(targetId, { attributes: ['id'] });
    if (bike) return 'bike';
  }
  return 'car';
};

/**
 * Add an item to wishlist (idempotent, prevents duplicates)
 */
exports.addToWishlist = async (userId, targetId, targetType = null) => {
  if (!targetId) throw new AppError('Target ID is required', 400);

  const type = await resolveVehicleType(targetId, targetType);

  if (type === 'commercial') {
    const commercial = await CommercialVehicle.findByPk(targetId);
    if (!commercial) throw new AppError('Commercial vehicle not found', 404);
    if (commercial.status !== 'active') {
      throw new AppError('Only active commercial vehicles can be added to wishlist', 400);
    }

    const [wishlist, created] = await Wishlist.findOrCreate({
      where: { user_id: userId, target_type: 'commercial', target_id: targetId },
      defaults: { user_id: userId, car_id: null, target_type: 'commercial', target_id: targetId },
    });
    if (created) {
      await invalidateWishlistCaches(userId, targetId, commercial.user_id, 'commercial');
    }
    const newCount = await Wishlist.count({
      where: { target_type: 'commercial', target_id: targetId },
    });
    return {
      wishlist,
      data: wishlist,
      is_wishlisted: true,
      isWishlist: true,
      wishlist_count: newCount,
    };
  }

  if (type === 'bike') {
    const bike = await Bike.findByPk(targetId);
    if (!bike) throw new AppError('Bike not found', 404);
    if (bike.status !== 'active') {
      throw new AppError('Only active bikes can be added to wishlist', 400);
    }

    const [wishlist, created] = await Wishlist.findOrCreate({
      where: { user_id: userId, target_type: 'bike', target_id: targetId },
      defaults: { user_id: userId, car_id: null, target_type: 'bike', target_id: targetId },
    });
    if (created) {
      await invalidateWishlistCaches(userId, targetId, bike.user_id, 'bike');
    }
    const newCount = await Wishlist.count({
      where: { target_type: 'bike', target_id: targetId },
    });
    return {
      wishlist,
      data: wishlist,
      is_wishlisted: true,
      isWishlist: true,
      wishlist_count: newCount,
    };
  }

  const car = await Car.findByPk(targetId);
  if (!car) throw new AppError('Car not found', 404);

  const [wishlist, created] = await Wishlist.findOrCreate({
    where: { user_id: userId, car_id: targetId },
    defaults: { user_id: userId, car_id: targetId, target_type: 'car', target_id: targetId },
  });

  if (created) {
    const analyticsService = require('./analyticsService');
    await analyticsService.recordInteraction({ carId: targetId, userId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, targetId, car.user_id, 'car');
  }

  const newCount = await Wishlist.count({
    where: {
      [Op.or]: [
        { car_id: targetId },
        { target_type: 'car', target_id: targetId },
      ],
    },
  });

  return {
    wishlist,
    data: wishlist,
    is_wishlisted: true,
    isWishlist: true,
    wishlist_count: newCount,
  };
};

/**
 * Toggle an item in wishlist (creates if absent, destroys if present)
 */
exports.toggleWishlist = async (userId, targetId, targetType = null) => {
  if (!targetId) throw new AppError('Target ID is required', 400);

  // Check if targetId is an existing Wishlist entry primary key for this user
  let wishlistEntry = await Wishlist.findOne({
    where: {
      user_id: userId,
      id: targetId,
    },
  });

  let type = targetType ? normalizeTargetType(targetType) : null;
  let vehicleId = targetId;

  if (wishlistEntry) {
    type = wishlistEntry.target_type === 'commercial' ? 'commercial' : (wishlistEntry.target_type === 'bike' ? 'bike' : 'car');
    vehicleId = (type === 'commercial' || type === 'bike') ? wishlistEntry.target_id : (wishlistEntry.car_id || wishlistEntry.target_id);
  } else if (!type) {
    type = await resolveVehicleType(vehicleId, null);
  }

  if (type === 'bike') {
    const bike = await Bike.findByPk(vehicleId);
    if (!bike) throw new AppError('Bike not found', 404);

    const existing = wishlistEntry || await Wishlist.findOne({
      where: { user_id: userId, target_type: 'bike', target_id: vehicleId },
    });

    if (existing) {
      await existing.destroy();
      await invalidateWishlistCaches(userId, vehicleId, bike.user_id, 'bike');
      const newCount = await Wishlist.count({
        where: { target_type: 'bike', target_id: vehicleId },
      });
      return {
        is_wishlisted: false,
        isWishlist: false,
        wishlist_count: newCount,
        message: 'Removed from wishlist',
      };
    }

    if (bike.status !== 'active') {
      throw new AppError('Only active bikes can be added to wishlist', 400);
    }

    const wishlist = await Wishlist.create({
      user_id: userId,
      car_id: null,
      target_type: 'bike',
      target_id: vehicleId,
    });
    await invalidateWishlistCaches(userId, vehicleId, bike.user_id, 'bike');
    const newCount = await Wishlist.count({
      where: { target_type: 'bike', target_id: vehicleId },
    });
    return {
      is_wishlisted: true,
      isWishlist: true,
      wishlist_count: newCount,
      message: 'Added to wishlist',
      data: wishlist,
    };
  }

  if (type === 'commercial') {
    const commercial = await CommercialVehicle.findByPk(vehicleId);
    if (!commercial) throw new AppError('Commercial vehicle not found', 404);

    const existing = wishlistEntry || await Wishlist.findOne({
      where: { user_id: userId, target_type: 'commercial', target_id: vehicleId },
    });

    if (existing) {
      await existing.destroy();
      await invalidateWishlistCaches(userId, vehicleId, commercial.user_id, 'commercial');
      const newCount = await Wishlist.count({
        where: { target_type: 'commercial', target_id: vehicleId },
      });
      return {
        is_wishlisted: false,
        isWishlist: false,
        wishlist_count: newCount,
        message: 'Removed from wishlist',
      };
    }

    if (commercial.status !== 'active') {
      throw new AppError('Only active commercial vehicles can be added to wishlist', 400);
    }

    const wishlist = await Wishlist.create({
      user_id: userId,
      car_id: null,
      target_type: 'commercial',
      target_id: vehicleId,
    });
    await invalidateWishlistCaches(userId, vehicleId, commercial.user_id, 'commercial');
    const newCount = await Wishlist.count({
      where: { target_type: 'commercial', target_id: vehicleId },
    });
    return {
      is_wishlisted: true,
      isWishlist: true,
      wishlist_count: newCount,
      message: 'Added to wishlist',
      data: wishlist,
    };
  }

  const car = await Car.findByPk(vehicleId);
  if (!car) throw new AppError('Car not found', 404);

  const existing = wishlistEntry || await Wishlist.findOne({
    where: {
      user_id: userId,
      [Op.or]: [
        { car_id: vehicleId },
        { target_type: 'car', target_id: vehicleId },
      ],
    },
  });

  if (existing) {
    await existing.destroy();
    const analyticsService = require('./analyticsService');
    await analyticsService.decrementInteraction({ carId: vehicleId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, vehicleId, car.user_id, 'car');
    const newCount = await Wishlist.count({
      where: {
        [Op.or]: [
          { car_id: vehicleId },
          { target_type: 'car', target_id: vehicleId },
        ],
      },
    });
    return {
      is_wishlisted: false,
      isWishlist: false,
      wishlist_count: newCount,
      message: 'Removed from wishlist',
    };
  }

  const wishlist = await Wishlist.create({
    user_id: userId,
    car_id: vehicleId,
    target_type: 'car',
    target_id: vehicleId,
  });
  const analyticsService = require('./analyticsService');
  await analyticsService.recordInteraction({ carId: vehicleId, userId, type: 'wishlist' });
  await invalidateWishlistCaches(userId, vehicleId, car.user_id, 'car');
  const newCount = await Wishlist.count({
    where: {
      [Op.or]: [
        { car_id: vehicleId },
        { target_type: 'car', target_id: vehicleId },
      ],
    },
  });
  return {
    is_wishlisted: true,
    isWishlist: true,
    wishlist_count: newCount,
    message: 'Added to wishlist',
    data: wishlist,
  };
};

/**
 * Remove an item from wishlist (idempotent)
 */
exports.removeFromWishlist = async (userId, targetId, targetType = null) => {
  if (!targetId) throw new AppError('Target ID is required', 400);

  // 1. Check if targetId is an existing Wishlist entry PK for this user
  let wishlistEntry = await Wishlist.findOne({
    where: {
      user_id: userId,
      id: targetId,
    },
  });

  let resolvedType = targetType ? normalizeTargetType(targetType) : null;
  let vehicleId = targetId;

  if (wishlistEntry) {
    resolvedType = wishlistEntry.target_type === 'commercial' ? 'commercial' : (wishlistEntry.target_type === 'bike' ? 'bike' : 'car');
    vehicleId = (resolvedType === 'commercial' || resolvedType === 'bike') ? wishlistEntry.target_id : (wishlistEntry.car_id || wishlistEntry.target_id);
  } else {
    if (!resolvedType) {
      resolvedType = await resolveVehicleType(targetId, null);
    }
    vehicleId = targetId;
  }

  let deletedCount = 0;
  if (wishlistEntry) {
    await wishlistEntry.destroy();
    deletedCount = 1;
  }

  if (resolvedType === 'bike') {
    const count = await Wishlist.destroy({
      where: {
        user_id: userId,
        target_type: 'bike',
        target_id: vehicleId,
      },
    });
    deletedCount += count;

    const bike = await Bike.findByPk(vehicleId, {
      attributes: ['id', 'user_id'],
      paranoid: false,
    });
    if (deletedCount > 0) {
      await invalidateWishlistCaches(userId, vehicleId, bike?.user_id || null, 'bike');
    }
    const newCount = await Wishlist.count({
      where: { target_type: 'bike', target_id: vehicleId },
    });
    return {
      success: true,
      message: 'Removed from wishlist',
      isWishlist: false,
      is_wishlisted: false,
      wishlist_count: newCount,
    };
  }

  if (resolvedType === 'commercial') {
    const count = await Wishlist.destroy({
      where: {
        user_id: userId,
        target_type: 'commercial',
        target_id: vehicleId,
      },
    });
    deletedCount += count;

    const commercial = await CommercialVehicle.findByPk(vehicleId, {
      attributes: ['id', 'user_id'],
      paranoid: false,
    });
    if (deletedCount > 0) {
      await invalidateWishlistCaches(userId, vehicleId, commercial?.user_id || null, 'commercial');
    }
    const newCount = await Wishlist.count({
      where: { target_type: 'commercial', target_id: vehicleId },
    });
    return {
      success: true,
      message: 'Removed from wishlist',
      isWishlist: false,
      is_wishlisted: false,
      wishlist_count: newCount,
    };
  }

  const count = await Wishlist.destroy({
    where: {
      user_id: userId,
      [Op.or]: [
        { car_id: vehicleId },
        { target_id: vehicleId, target_type: 'car' },
      ],
    },
  });
  deletedCount += count;

  const car = await Car.findByPk(vehicleId, {
    attributes: ['id', 'user_id'],
    paranoid: false,
  });
  if (deletedCount > 0) {
    const analyticsService = require('./analyticsService');
    await analyticsService.decrementInteraction({ carId: vehicleId, type: 'wishlist' });
    await invalidateWishlistCaches(userId, vehicleId, car?.user_id || null, 'car');
  }
  const newCount = await Wishlist.count({
    where: {
      [Op.or]: [
        { car_id: vehicleId },
        { target_type: 'car', target_id: vehicleId },
      ],
    },
  });
  return {
    success: true,
    message: 'Removed from wishlist',
    isWishlist: false,
    is_wishlisted: false,
    wishlist_count: newCount,
  };
};

const buildCarInclude = () => [
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
];

const buildCommercialInclude = () => [
  { model: CommercialVehicleImage, as: 'images', attributes: ['id', 'image_url', 'is_primary', 'sort_order'] },
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
  { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
  { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
  { model: District, as: 'district', attributes: ['id', 'name'] },
  { model: City, as: 'city', attributes: ['id', 'name'] },
];

const buildBikeInclude = () => [
  { model: BikeImage, as: 'images', attributes: ['id', 'image_url', 'is_primary', 'sort_order'] },
  {
    model: User,
    as: 'seller',
    attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
    include: [
      { model: District, as: 'district', attributes: ['name'] },
      { model: DealerProfile, as: 'dealerProfile', attributes: ['company_name'] },
    ],
  },
  { model: Brand, as: 'brand', attributes: ['id', 'name', 'slug', 'logo'] },
  { model: Model, as: 'bikeModel', attributes: ['id', 'name', 'body_type'] },
  { model: CarType, as: 'vehicleType', attributes: ['id', 'name', 'slug'] },
  { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
  { model: District, as: 'district', attributes: ['id', 'name'] },
  { model: City, as: 'city', attributes: ['id', 'name'] },
];

/**
 * Get user's wishlist items filtered by target_type ('car' | 'commercial' | 'bike' | 'all').
 * Legacy safeguard: defaults strictly to 'car' so older clients without ?target_type never receive commercial/bike objects.
 */
exports.getWishlist = async (userId, options = {}) => {
  const opts = typeof options === 'string' ? { targetType: options } : (options || {});
  const requestedType = String(opts.targetType || 'car').trim().toLowerCase();
  if (!['car', 'commercial', 'bike', 'all'].includes(requestedType)) {
    throw new AppError('target_type must be one of: car, commercial, bike, all', 400);
  }

  const baseUrl = opts.baseUrl || process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const viewerUser = opts.viewerUser || { id: userId, role: 'customer' };

  const where = { user_id: userId };
  if (requestedType === 'car') {
    where[Op.or] = [{ target_type: 'car' }, { target_type: null }];
  } else if (requestedType === 'commercial') {
    where.target_type = 'commercial';
  } else if (requestedType === 'bike') {
    where.target_type = 'bike';
  }

  const entries = await Wishlist.findAll({
    where,
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  if (entries.length === 0) {
    return [];
  }

  const carIds = [];
  const commercialIds = [];
  const bikeIds = [];
  for (const entry of entries) {
    if (entry.target_type === 'commercial') {
      if (entry.target_id) commercialIds.push(entry.target_id);
    } else if (entry.target_type === 'bike') {
      if (entry.target_id) bikeIds.push(entry.target_id);
    } else {
      const cid = entry.car_id || entry.target_id;
      if (cid) carIds.push(cid);
    }
  }

  const uniqueCarIds = [...new Set(carIds)];
  const uniqueCommercialIds = [...new Set(commercialIds)];
  const uniqueBikeIds = [...new Set(bikeIds)];

  const [cars, commercials, bikes, commercialWishlistCounts, carWishlistCounts, bikeWishlistCounts] = await Promise.all([
    uniqueCarIds.length > 0
      ? Car.findAll({ where: { id: { [Op.in]: uniqueCarIds } }, include: buildCarInclude() })
      : Promise.resolve([]),
    uniqueCommercialIds.length > 0
      ? CommercialVehicle.findAll({
          where: { id: { [Op.in]: uniqueCommercialIds } },
          include: buildCommercialInclude(),
        })
      : Promise.resolve([]),
    uniqueBikeIds.length > 0
      ? Bike.findAll({
          where: { id: { [Op.in]: uniqueBikeIds } },
          include: buildBikeInclude(),
        })
      : Promise.resolve([]),
    uniqueCommercialIds.length > 0
      ? Wishlist.findAll({
          where: {
            target_type: 'commercial',
            target_id: { [Op.in]: uniqueCommercialIds },
          },
          attributes: ['target_id', [sequelize.fn('COUNT', sequelize.col('id')), 'wishlist_count']],
          group: ['target_id'],
          raw: true,
        })
      : Promise.resolve([]),
    uniqueCarIds.length > 0
      ? Wishlist.findAll({
          where: {
            [Op.or]: [
              { car_id: { [Op.in]: uniqueCarIds } },
              { target_type: 'car', target_id: { [Op.in]: uniqueCarIds } },
            ],
          },
          attributes: [
            [sequelize.literal("COALESCE(car_id, target_id)"), 'car_id'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'wishlist_count'],
          ],
          group: [sequelize.literal("COALESCE(car_id, target_id)")],
          raw: true,
        })
      : Promise.resolve([]),
    uniqueBikeIds.length > 0
      ? Wishlist.findAll({
          where: {
            target_type: 'bike',
            target_id: { [Op.in]: uniqueBikeIds },
          },
          attributes: ['target_id', [sequelize.fn('COUNT', sequelize.col('id')), 'wishlist_count']],
          group: ['target_id'],
          raw: true,
        })
      : Promise.resolve([]),
  ]);

  const carMap = new Map(cars.map((c) => [c.id, c]));
  const commercialMap = new Map(commercials.map((v) => [v.id, v]));
  const bikeMap = new Map(bikes.map((b) => [b.id, b]));
  const countMap = {};
  for (const row of commercialWishlistCounts) {
    countMap[row.target_id] = parseInt(row.wishlist_count, 10) || 0;
  }
  const carCountMap = {};
  for (const row of carWishlistCounts) {
    carCountMap[row.car_id] = parseInt(row.wishlist_count, 10) || 0;
  }
  const bikeCountMap = {};
  for (const row of bikeWishlistCounts) {
    bikeCountMap[row.target_id] = parseInt(row.wishlist_count, 10) || 0;
  }

  const { transformCarImages } = require('./carService');
  const { transformCommercialVehicleImages } = require('./commercialVehicleService');
  const { transformBike } = require('./bikeService');

  const results = [];
  for (const entry of entries) {
    if (entry.target_type === 'commercial') {
      const vehicle = commercialMap.get(entry.target_id);
      if (!vehicle) continue;
      results.push({
        ...transformCommercialVehicleImages(vehicle, baseUrl, viewerUser),
        target_type: 'commercial',
        target_id: vehicle.id,
        wishlist_count: countMap[vehicle.id] || 0,
        wishlisted_at: entry.created_at,
        isWishlist: true,
        is_wishlist: true,
      });
    } else if (entry.target_type === 'bike') {
      const bike = bikeMap.get(entry.target_id);
      if (!bike) continue;
      results.push({
        ...transformBike(bike, viewerUser),
        target_type: 'bike',
        target_id: bike.id,
        wishlist_count: bikeCountMap[bike.id] || 0,
        wishlisted_at: entry.created_at,
        isWishlist: true,
        is_wishlist: true,
      });
    } else {
      const cid = entry.car_id || entry.target_id;
      const car = carMap.get(cid);
      if (!car) continue;
      results.push({
        ...transformCarImages(car, baseUrl),
        target_type: 'car',
        target_id: car.id,
        wishlist_count: carCountMap[car.id] || 0,
        wishlisted_at: entry.created_at,
        isWishlist: true,
        is_wishlist: true,
      });
    }
  }

  return results;
};

/**
 * Get users who wishlisted a specific car or commercial vehicle (strict seller ownership check).
 */
exports.getTargetWishlists = async (sellerId, targetId, targetType = 'car', { limit = 20, cursor = null } = {}) => {
  let type = normalizeTargetType(targetType);

  let listing = null;
  let infoPayload = null;

  if (type === 'commercial') {
    listing = await CommercialVehicle.findByPk(targetId, {
      paranoid: false,
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      ],
    });

    if (!listing) {
      // Check if targetId is actually a car or bike (polymorphic fallback)
      const car = await Car.unscoped().findByPk(targetId, { attributes: ['id', 'user_id'] });
      if (car) {
        return exports.getTargetWishlists(sellerId, targetId, 'car', { limit, cursor });
      }
      const bike = await Bike.findByPk(targetId, { attributes: ['id', 'user_id'], paranoid: false });
      if (bike) {
        return exports.getTargetWishlists(sellerId, targetId, 'bike', { limit, cursor });
      }
      throw new AppError('Commercial vehicle not found', 404);
    }
    if (listing.user_id !== sellerId) {
      throw new AppError('You are not authorized to view these metrics', 403);
    }
    const name = [listing.brand?.name, listing.vehicleType?.name].filter(Boolean).join(' ') || 'Commercial Vehicle';
    infoPayload = {
      id: listing.id,
      name,
      slug: listing.slug || null,
      year: listing.year || null,
      number_plate: null,
      type: 'commercial',
    };
  } else if (type === 'bike') {
    listing = await Bike.findByPk(targetId, {
      paranoid: false,
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'bikeModel', attributes: ['id', 'name'] },
      ],
    });

    if (!listing) {
      const car = await Car.unscoped().findByPk(targetId, { attributes: ['id', 'user_id'] });
      if (car) {
        return exports.getTargetWishlists(sellerId, targetId, 'car', { limit, cursor });
      }
      const commercial = await CommercialVehicle.findByPk(targetId, { attributes: ['id', 'user_id'], paranoid: false });
      if (commercial) {
        return exports.getTargetWishlists(sellerId, targetId, 'commercial', { limit, cursor });
      }
      throw new AppError('Bike not found', 404);
    }
    if (listing.user_id !== sellerId) {
      throw new AppError('You are not authorized to view these metrics', 403);
    }
    const name = [listing.brand?.name, listing.bikeModel?.name].filter(Boolean).join(' ') || 'Bike';
    infoPayload = {
      id: listing.id,
      name,
      slug: listing.slug || null,
      year: listing.year || null,
      number_plate: null,
      type: 'bike',
    };
  } else {
    listing = await Car.unscoped().findByPk(targetId, {
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      ],
    });

    if (!listing) {
      // Check if targetId is actually a commercial vehicle or bike (polymorphic fallback)
      const commercial = await CommercialVehicle.findByPk(targetId, { attributes: ['id', 'user_id'], paranoid: false });
      if (commercial) {
        return exports.getTargetWishlists(sellerId, targetId, 'commercial', { limit, cursor });
      }
      const bike = await Bike.findByPk(targetId, { attributes: ['id', 'user_id'], paranoid: false });
      if (bike) {
        return exports.getTargetWishlists(sellerId, targetId, 'bike', { limit, cursor });
      }
      throw new AppError('Car not found', 404);
    }
    if (listing.user_id !== sellerId) {
      throw new AppError('You are not authorized to view these metrics', 403);
    }
    const carName = [listing.brand?.name, listing.carModel?.name].filter(Boolean).join(' ') || 'Pre-Owned Car';
    infoPayload = {
      id: listing.id,
      name: carName,
      number_plate: listing.number_plate || null,
      type: 'car',
    };
  }

  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const cacheKey = `${type}:wishlists:${targetId}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getTargetWishlists:', err);
  }

  const buildBaseWhere = () =>
    (type === 'commercial' || type === 'bike')
      ? { target_type: type, target_id: targetId }
      : {
          [Op.or]: [
            { car_id: targetId },
            { target_type: 'car', target_id: targetId },
          ],
        };

  const baseWhere = buildBaseWhere();
  const whereClause = buildBaseWhere();

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    const cursorFilter = decodedCursor.id
      ? {
          [Op.or]: [
            { created_at: { [Op.lt]: new Date(decodedCursor.created_at) } },
            {
              created_at: new Date(decodedCursor.created_at),
              id: { [Op.lt]: decodedCursor.id },
            },
          ],
        }
      : { created_at: { [Op.lt]: new Date(decodedCursor.created_at) } };

    whereClause[Op.and] = whereClause[Op.and] ? [...whereClause[Op.and], cursorFilter] : [cursorFilter];
  }

  const [totalWishlists, wishlists] = await Promise.all([
    Wishlist.count({ where: baseWhere }),
    Wishlist.findAll({
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
    }),
  ]);

  const formattedWishlists = wishlists.map((w) => {
    const json = typeof w.toJSON === 'function' ? w.toJSON() : w;
    return {
      user_name: json.user?.full_name || 'Anonymous',
      user_phone: json.user?.phone || 'N/A',
      masked_phone: maskPhone(json.user?.phone),
      wishlisted_at: json.created_at,
    };
  });

  const lastItem = wishlists.length > 0 ? wishlists[wishlists.length - 1] : null;
  const nextCursor = lastItem
    ? encodeCursor({ created_at: lastItem.created_at, id: lastItem.id })
    : null;

  const result = {
    target_type: type,
    car_info: infoPayload, // Always provided for backward compatibility
    vehicle_info: infoPayload, // Unified vehicle info
    commercial_info: type === 'commercial' ? infoPayload : null,
    total_wishlists: parseInt(totalWishlists, 10) || 0,
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
    console.error('Redis set cache error in getTargetWishlists:', err);
  }

  return result;
};

/**
 * Backward-compatible wrapper for car wishlists metrics.
 */
exports.getCarWishlists = async (sellerId, carId, options = {}) => {
  return exports.getTargetWishlists(sellerId, carId, 'car', options);
};

/**
 * Dedicated wrapper for commercial vehicle wishlists metrics.
 */
exports.getCommercialWishlists = async (sellerId, commercialId, options = {}) => {
  return exports.getTargetWishlists(sellerId, commercialId, 'commercial', options);
};

/**
 * Dedicated wrapper for bike wishlists metrics.
 */
exports.getBikeWishlists = async (sellerId, bikeId, options = {}) => {
  return exports.getTargetWishlists(sellerId, bikeId, 'bike', options);
};
