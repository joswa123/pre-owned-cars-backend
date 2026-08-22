const { View, Car, User, Brand, Model } = require('../models');
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

/**
 * Get distinct registered users who viewed a specific car (seller authorization check)
 */
exports.getCarViews = async (sellerId, carId, { limit = 20, cursor = null } = {}) => {
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
  const cacheKey = `car:views:${carId}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getCarViews:', err);
  }

  const whereClause = {
    car_id: carId,
    user_id: { [Op.ne]: null },
  };

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    if (decodedCursor.id) {
      whereClause[Op.or] = [
        { timestamp: { [Op.lt]: new Date(decodedCursor.timestamp) } },
        {
          timestamp: new Date(decodedCursor.timestamp),
          id: { [Op.lt]: decodedCursor.id },
        },
      ];
    } else {
      whereClause.timestamp = { [Op.lt]: new Date(decodedCursor.timestamp) };
    }
  }

  const views = await View.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'phone'],
      },
    ],
    order: [
      ['timestamp', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limitNum,
  });

  const formattedViews = views.map((v) => {
    const json = typeof v.toJSON === 'function' ? v.toJSON() : v;
    return {
      user_name: json.user?.full_name || 'Anonymous',
      user_phone: json.user?.phone || 'N/A',
      viewed_at: json.timestamp,
    };
  });

  const lastView = views.length > 0 ? views[views.length - 1] : null;
  const nextCursor = lastView
    ? encodeCursor({ timestamp: lastView.timestamp, id: lastView.id })
    : null;

  const carName = [car.brand?.name, car.carModel?.name].filter(Boolean).join(' ') || 'Pre-Owned Car';

  const result = {
    car_info: {
      id: car.id,
      name: carName,
      number_plate: car.number_plate,
    },
    views: formattedViews,
    pagination: {
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
