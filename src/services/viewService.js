const { View, Car, User, Brand, Model, CarStat, CommercialVehicle, CarType, Bike } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const redisClient = require('../config/redis');

const encodeCursor = (cursorObj) => {
  if (!cursorObj || !cursorObj.timestamp) return null;
  return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
};

const decodeCursor = (cursorStr) => {
  if (!cursorStr) return null;
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.timestamp || parsed.created_at)) {
      return { timestamp: parsed.timestamp || parsed.created_at, id: parsed.id || null };
    }
  } catch (e) {
    const d = new Date(cursorStr);
    if (!isNaN(d.getTime())) {
      return { timestamp: d.toISOString(), id: null };
    }
  }
  return null;
};

const maskPhone = (phone) => {
  if (!phone) return null;
  const str = String(phone).trim();
  if (str.length <= 4) return '******';
  return '*'.repeat(str.length - 4) + str.slice(-4);
};

/**
 * Get distinct registered users who viewed a specific car (seller authorization check)
 */
exports.getCarViews = async (sellerId, carId, { limit = 20, cursor = null } = {}) => {
  // 1. Security Check: Verify car exists and belongs to this seller (unscoped to allow sold/deleted cars)
  const car = await Car.unscoped().findOne({
    where: { id: carId, user_id: sellerId },
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });

  if (!car) {
    // Check if carId is actually a commercial vehicle belonging to this seller (paranoid: false to allow sold/deleted)
    const commercial = await CommercialVehicle.findOne({
      where: { id: carId, user_id: sellerId },
      paranoid: false,
    });
    if (commercial) {
      return exports.getCommercialViews(sellerId, carId, { limit, cursor });
    }
    const bike = await Bike.findOne({
      where: { id: carId, user_id: sellerId },
      paranoid: false,
    });
    if (bike) {
      return exports.getBikeViews(sellerId, carId, { limit, cursor });
    }
    throw new AppError('Vehicle not found or you are not authorized to view these metrics', 404);
  }

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const cacheKey = `car:views:${carId}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getCarViews:', err);
  }

  const baseRegisteredWhere = {
    [Op.or]: [
      { car_id: carId },
      { target_type: 'car', target_id: carId },
    ],
    user_id: { [Op.ne]: null },
  };

  const queryWhere = { ...baseRegisteredWhere };
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    if (decodedCursor.id) {
      queryWhere[Op.or] = [
        { timestamp: { [Op.lt]: new Date(decodedCursor.timestamp) } },
        {
          timestamp: new Date(decodedCursor.timestamp),
          id: { [Op.lt]: decodedCursor.id },
        },
      ];
    } else {
      queryWhere.timestamp = { [Op.lt]: new Date(decodedCursor.timestamp) };
    }
  }

  const [registeredResult, totalRegisteredCount, totalDbViews, carStat] = await Promise.all([
    View.findAndCountAll({
      where: queryWhere,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone'],
          required: false,
        },
      ],
      order: [
        ['timestamp', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limitNum,
    }),
    View.count({ where: baseRegisteredWhere }),
    View.count({
      where: {
        [Op.or]: [
          { car_id: carId },
          { target_type: 'car', target_id: carId },
        ],
      },
    }),
    CarStat.findOne({ where: { car_id: carId } }),
  ]);

  const views = registeredResult.rows;
  const registeredViews = totalRegisteredCount;
  const totalViews = Math.max(carStat?.views_count || 0, totalDbViews);
  const anonymousViews = Math.max(totalViews - registeredViews, 0);

  const formattedViews = views.map((v) => {
    const json = typeof v.toJSON === 'function' ? v.toJSON() : v;
    return {
      user_name: json.user?.full_name || 'Anonymous Visitor',
      user_phone: json.user?.phone || 'N/A',
      masked_phone: json.user?.phone ? maskPhone(json.user.phone) : 'N/A',
      viewed_at: json.timestamp,
    };
  });

  const lastView = views.length > 0 ? views[views.length - 1] : null;
  const nextCursor = lastView
    ? encodeCursor({ timestamp: lastView.timestamp, id: lastView.id })
    : null;

  const carName = [car.brand?.name, car.carModel?.name].filter(Boolean).join(' ') || 'Pre-Owned Car';

  const carInfo = {
    id: car.id,
    name: carName,
    number_plate: car.number_plate,
    type: 'car',
  };

  const result = {
    car_info: carInfo,
    vehicle_info: carInfo,
    commercial_info: null,
    meta: {
      total_views: totalViews,
      registered_views: registeredViews,
      anonymous_views: anonymousViews,
    },
    views: formattedViews,
    pagination: {
      total: registeredViews,
      limit: limitNum,
      next_cursor: nextCursor,
      has_more: formattedViews.length === limitNum,
    },
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 30, JSON.stringify(result));
    }
  } catch (err) {
    console.error('Redis set cache error in getCarViews:', err);
  }

  return result;
};

/**
 * Get distinct registered users who viewed a specific commercial vehicle (seller authorization check)
 */
exports.getCommercialViews = async (sellerId, commercialId, { limit = 20, cursor = null } = {}) => {
  // 1. Security Check: Verify commercial vehicle exists and belongs to this seller (paranoid: false to allow sold/deleted)
  const vehicle = await CommercialVehicle.findOne({
    where: { id: commercialId, user_id: sellerId },
    paranoid: false,
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
    ],
  });

  if (!vehicle) {
    // If not found in commercial, check if it's a regular car (unscoped to allow sold/deleted)
    const car = await Car.unscoped().findOne({
      where: { id: commercialId, user_id: sellerId },
    });
    if (car) {
      return exports.getCarViews(sellerId, commercialId, { limit, cursor });
    }
    throw new AppError('Commercial vehicle not found or you are not authorized to view these metrics', 404);
  }

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const cacheKey = `commercial:views:${commercialId}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getCommercialViews:', err);
  }

  const baseRegisteredWhere = {
    target_type: 'commercial',
    target_id: commercialId,
    user_id: { [Op.ne]: null },
  };

  const queryWhere = { ...baseRegisteredWhere };
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    if (decodedCursor.id) {
      queryWhere[Op.or] = [
        { timestamp: { [Op.lt]: new Date(decodedCursor.timestamp) } },
        {
          timestamp: new Date(decodedCursor.timestamp),
          id: { [Op.lt]: decodedCursor.id },
        },
      ];
    } else {
      queryWhere.timestamp = { [Op.lt]: new Date(decodedCursor.timestamp) };
    }
  }

  const [registeredResult, totalRegisteredCount, totalDbViews] = await Promise.all([
    View.findAndCountAll({
      where: queryWhere,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone'],
          required: false,
        },
      ],
      order: [
        ['timestamp', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limitNum,
    }),
    View.count({ where: baseRegisteredWhere }),
    View.count({ where: { target_type: 'commercial', target_id: commercialId } }),
  ]);

  const views = registeredResult.rows;
  const registeredViews = totalRegisteredCount;
  const totalViews = Math.max(vehicle.views_count || 0, totalDbViews);
  const anonymousViews = Math.max(totalViews - registeredViews, 0);

  const formattedViews = views.map((v) => {
    const json = typeof v.toJSON === 'function' ? v.toJSON() : v;
    return {
      user_name: json.user?.full_name || 'Anonymous Visitor',
      user_phone: json.user?.phone || 'N/A',
      masked_phone: json.user?.phone ? maskPhone(json.user.phone) : 'N/A',
      viewed_at: json.timestamp,
    };
  });

  const lastView = views.length > 0 ? views[views.length - 1] : null;
  const nextCursor = lastView
    ? encodeCursor({ timestamp: lastView.timestamp, id: lastView.id })
    : null;

  const vehicleName = [vehicle.brand?.name, vehicle.vehicleType?.name].filter(Boolean).join(' ') || 'Commercial Vehicle';

  const vehicleInfo = {
    id: vehicle.id,
    name: vehicleName,
    year: vehicle.year,
    price: vehicle.price,
    status: vehicle.status,
    number_plate: null,
    type: 'commercial',
  };

  const result = {
    car_info: vehicleInfo, // For backwards compatibility so existing UI components don't crash
    vehicle_info: vehicleInfo,
    commercial_info: vehicleInfo,
    meta: {
      total_views: totalViews,
      registered_views: registeredViews,
      anonymous_views: anonymousViews,
    },
    views: formattedViews,
    pagination: {
      total: registeredViews,
      limit: limitNum,
      next_cursor: nextCursor,
      has_more: formattedViews.length === limitNum,
    },
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 30, JSON.stringify(result));
    }
  } catch (err) {
    console.error('Redis set cache error in getCommercialViews:', err);
  }

  return result;
};

/**
 * Get distinct registered users who viewed a specific bike (seller authorization check)
 */
exports.getBikeViews = async (sellerId, bikeId, { limit = 20, cursor = null } = {}) => {
  const bike = await Bike.findOne({
    where: { id: bikeId, user_id: sellerId },
    paranoid: false,
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'bikeModel', attributes: ['id', 'name'] },
    ],
  });
  if (!bike) {
    throw new AppError('Bike not found or you are not authorized to view these metrics', 404);
  }

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const baseRegisteredWhere = {
    target_type: 'bike',
    target_id: bikeId,
    user_id: { [Op.ne]: null },
  };
  const queryWhere = { ...baseRegisteredWhere };
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    queryWhere.timestamp = { [Op.lt]: new Date(decodedCursor.timestamp) };
  }

  const [registeredResult, totalRegisteredCount, totalDbViews] = await Promise.all([
    View.findAndCountAll({
      where: queryWhere,
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'], required: false }],
      order: [['timestamp', 'DESC'], ['id', 'DESC']],
      limit: limitNum,
    }),
    View.count({ where: baseRegisteredWhere }),
    View.count({ where: { target_type: 'bike', target_id: bikeId } }),
  ]);

  const views = registeredResult.rows;
  const totalViews = Math.max(bike.views_count || 0, totalDbViews);
  const formattedViews = views.map((v) => {
    const json = typeof v.toJSON === 'function' ? v.toJSON() : v;
    return {
      user_name: json.user?.full_name || 'Anonymous Visitor',
      user_phone: json.user?.phone || 'N/A',
      masked_phone: json.user?.phone ? maskPhone(json.user.phone) : 'N/A',
      viewed_at: json.timestamp,
    };
  });

  const lastView = views.length > 0 ? views[views.length - 1] : null;
  const vehicleInfo = {
    id: bike.id,
    name: bike.title || [bike.brand?.name, bike.bikeModel?.name].filter(Boolean).join(' ') || 'Bike',
    year: bike.year,
    price: bike.price,
    status: bike.status,
    number_plate: null,
    type: 'bike',
  };

  return {
    car_info: vehicleInfo,
    vehicle_info: vehicleInfo,
    meta: {
      total_views: totalViews,
      registered_views: totalRegisteredCount,
      anonymous_views: Math.max(totalViews - totalRegisteredCount, 0),
    },
    views: formattedViews,
    pagination: {
      total: totalRegisteredCount,
      limit: limitNum,
      next_cursor: lastView ? encodeCursor({ timestamp: lastView.timestamp, id: lastView.id }) : null,
      has_more: formattedViews.length === limitNum,
    },
  };
};
