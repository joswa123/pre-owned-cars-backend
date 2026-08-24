const { Lead, Car, User, Brand, Model, Variant, CarImage, CarStat, View, Wishlist } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { AppError } = require('../utils/errorHandler');
const redisClient = require('../config/redis');

const clearCachePattern = async (pattern) => {
  try {
    if (redisClient.isOpen) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (err) {
    console.error('Redis clear pattern error:', err);
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

const formatLead = (lead) => {
  if (!lead) return null;
  const json = typeof lead.toJSON === 'function' ? lead.toJSON() : { ...lead };
  const car = json.car;
  const carFormatted = car ? {
    id: car.id,
    name: [car.brand?.name, car.carModel?.name, car.carVariant?.name].filter(Boolean).join(' ') || 'Pre-Owned Car',
    brand: car.brand?.name || null,
    model: car.carModel?.name || null,
    variant: car.carVariant?.name || null,
    year: car.year || null,
    price: car.price || null,
    status: car.status || null,
    number_plate: car.number_plate || null,
    primary_image: car.images?.find((i) => i.is_primary)?.image_url || car.images?.[0]?.image_url || null,
    metrics: {
      views: car.stats?.views_count || 0,
      total_enquiries: car.stats?.enquiries_count || 0,
      total_calls: car.stats?.calls_count || 0,
      total_whatsapp: car.stats?.whatsapp_count || 0,
      total_messages: car.stats?.messages_count || 0,
      wishlist_count: car.stats?.wishlist_count || 0,
    },
  } : null;

  const buyerName = json.buyer?.full_name || json.buyer_name || 'Anonymous';
  const buyerPhone = json.contact_phone || json.buyer?.phone || json.buyer_phone || 'N/A';
  const buyerEmail = json.buyer?.email || json.buyer_email || null;

  return {
    id: json.id,
    interaction_id: json.id,
    type: json.source || 'message',
    status: json.status || 'new',
    is_viewed: json.is_viewed || false,
    interacted_at: json.created_at || json.createdAt,
    created_at: json.created_at || json.createdAt,
    buyer_id: json.buyer_id,
    buyer: {
      id: json.buyer_id,
      full_name: buyerName,
      phone: buyerPhone,
      email: buyerEmail,
      role: json.buyer?.role || 'customer',
      city: json.buyer?.city || null,
      state: json.buyer?.state || null,
      profile_picture: json.buyer?.profile_picture || null,
    },
    car: carFormatted,
  };
};

/**
 * Get single lead details by ID with associations
 */
exports.getLeadById = async (leadId) => {
  const lead = await Lead.findByPk(leadId, {
    include: [
      {
        model: Car,
        as: 'car',
        attributes: ['id', 'year', 'price', 'status', 'brand_id', 'model_id', 'variant_id', 'body_type'],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        ],
      },
      {
        model: User,
        as: 'seller',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
      {
        model: User,
        as: 'buyer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
    ],
  });

  return lead ? formatLead(lead) : null;
};

/**
 * Create a new lead/enquiry
 */
exports.createLead = async (userId, data) => {
  const carId = data.car_id || data.carId;
  if (!carId) throw new AppError('car_id is required', 400);

  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found', 404);
  if (car.status !== 'active') throw new AppError('Car is not available for enquiry', 400);

  if (car.user_id === userId) {
    throw new AppError('Cannot enquire on your own car listing', 400);
  }

  let buyer = null;
  if (userId) {
    buyer = await User.findByPk(userId);
  }

  const buyerName = data.name || buyer?.full_name || 'Guest User';
  const buyerPhone = data.contact_phone || data.phone || buyer?.phone || '';
  const buyerEmail = data.email || buyer?.email || null;

  const lead = await Lead.create({
    car_id: car.id,
    seller_id: car.user_id,
    buyer_id: userId || null,
    buyer_name: buyerName,
    buyer_phone: buyerPhone,
    buyer_email: buyerEmail,
    message: data.message || null,
    contact_phone: data.contact_phone || buyerPhone || null,
    preferred_contact: data.preferred_contact || 'phone',
    source: data.source || 'message',
    status: 'new',
    is_viewed: false,
    contact_unlocked: false,
  });

  await clearCachePattern(`seller:leads:${car.user_id}:*`);
  await clearCachePattern(`seller:lead_summary:${car.user_id}:*`);
  await clearCachePattern(`car:leads:${car.id}:*`);
  if (userId) {
    await clearCachePattern(`buyer:leads:${userId}:*`);
  }

  const dashboardService = require('./dashboardService');
  await dashboardService.invalidateDashboardCache(car.user_id);
  if (userId) {
    await dashboardService.invalidateDashboardCache(userId);
  }

  // Synchronize with Analytics Engine (Redis Buffer + car_stats)
  try {
    const analyticsService = require('./analyticsService');
    const interactionType = data.source === 'call' ? 'call' : data.source === 'whatsapp' ? 'whatsapp' : 'message';
    await analyticsService.recordInteraction({
      carId: car.id,
      userId: userId || null,
      type: interactionType,
    });
    await analyticsService.recordInteraction({
      carId: car.id,
      userId: userId || null,
      type: 'enquiry',
    });
  } catch (statErr) {
    console.warn('Lead analytics synchronization warning:', statErr.message);
  }

  return await exports.getLeadById(lead.id);
};

/**
 * Summary API: Cars grouped by lead stats with cursor pagination & Redis cache
 */
exports.getLeadSummary = async (sellerId, { status = null, limit = 20, cursor = null } = {}) => {
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const cacheKey = `seller:lead_summary:${sellerId}:${status || 'all'}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getLeadSummary:', err);
  }

  const whereClause = { user_id: sellerId };
  let queryModel = Car;
  if (status && status !== 'all') {
    whereClause.status = status;
    if (status === 'deleted') {
      queryModel = Car.unscoped();
    }
  }

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

  const cars = await queryModel.findAll({
    where: whereClause,
    attributes: ['id', 'brand_id', 'model_id', 'variant_id', 'price', 'number_plate', 'status', 'created_at'],
    include: [
      {
        model: Brand,
        as: 'brand',
        attributes: ['id', 'name'],
      },
      {
        model: Model,
        as: 'carModel',
        attributes: ['id', 'name'],
      },
      {
        model: Variant,
        as: 'carVariant',
        attributes: ['id', 'name'],
      },
      {
        model: CarStat,
        as: 'stats',
        attributes: [
          'views_count',
          'enquiries_count',
          'calls_count',
          'whatsapp_count',
          'messages_count',
          'wishlist_count',
        ],
        required: false,
      },
      {
        model: CarImage,
        as: 'images',
        attributes: ['id', 'image_url', 'is_primary'],
        required: false,
      },
    ],
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limitNum,
  });

  const carIds = cars.map((c) => c.id);

  // Aggregate live counts from Lead, View, and Wishlist tables for accurate metrics
  let leadMap = {};
  let viewMap = {};
  let wishlistMap = {};

  if (carIds.length > 0) {
    const [leadStats, viewStats, wishlistStats] = await Promise.all([
      Lead.findAll({
        attributes: [
          'car_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_leads'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'call' THEN 1 ELSE 0 END")), 'calls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'whatsapp' THEN 1 ELSE 0 END")), 'whatsapp'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) IN ('message', 'chat') THEN 1 ELSE 0 END")), 'messages'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) NOT IN ('call', 'whatsapp', 'message', 'chat') THEN 1 ELSE 0 END")), 'other_enquiries'],
        ],
        where: {
          car_id: { [Op.in]: carIds },
        },
        group: ['car_id'],
        raw: true,
      }),
      View.findAll({
        attributes: [
          'car_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'views_count'],
        ],
        where: { car_id: { [Op.in]: carIds } },
        group: ['car_id'],
        raw: true,
      }),
      Wishlist.findAll({
        attributes: [
          'car_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'wishlist_count'],
        ],
        where: { car_id: { [Op.in]: carIds } },
        group: ['car_id'],
        raw: true,
      }),
    ]);

    leadStats.forEach((l) => {
      leadMap[l.car_id] = {
        total: parseInt(l.total_leads, 10) || 0,
        calls: parseInt(l.calls, 10) || 0,
        whatsapp: parseInt(l.whatsapp, 10) || 0,
        messages: parseInt(l.messages, 10) || 0,
        other: parseInt(l.other_enquiries, 10) || 0,
      };
    });

    viewStats.forEach((v) => {
      viewMap[v.car_id] = parseInt(v.views_count, 10) || 0;
    });

    wishlistStats.forEach((w) => {
      wishlistMap[w.car_id] = parseInt(w.wishlist_count, 10) || 0;
    });
  }

  const formattedCars = cars.map((car) => {
    const json = typeof car.toJSON === 'function' ? car.toJSON() : car;
    const nameParts = [json.brand?.name, json.carModel?.name, json.carVariant?.name].filter(Boolean);
    const carName = nameParts.length > 0 ? nameParts.join(' ') : 'Pre-Owned Car';
    const primaryImg = json.images?.find((img) => img.is_primary)?.image_url || json.images?.[0]?.image_url || null;

    const stats = json.stats || {};
    const lData = leadMap[json.id] || { total: 0, calls: 0, whatsapp: 0, messages: 0, other: 0 };
    const dbViews = viewMap[json.id] || 0;
    const dbWishlist = wishlistMap[json.id] || 0;

    const calls = lData.calls;
    const whatsapp = lData.whatsapp;
    const messages = lData.messages;
    const totalLeadCount = lData.total;
    const views = Math.max(dbViews, stats.views_count || 0);
    const wishlist = Math.max(dbWishlist, stats.wishlist_count || 0);
    const enquiries = lData.other > 0 ? lData.other : (stats.enquiries_count || totalLeadCount);

    return {
      car_id: json.id,
      name: carName,
      price: json.price,
      number_plate: json.number_plate,
      status: json.status,
      primary_image: primaryImg,
      total_lead_count: totalLeadCount,
      breakdown: {
        calls,
        whatsapp,
        messages,
        enquiries,
        views,
        wishlist,
      },
      created_at: json.created_at,
    };
  });

  const lastCar = formattedCars.length > 0 ? formattedCars[formattedCars.length - 1] : null;
  const nextCursor = lastCar
    ? encodeCursor({ created_at: lastCar.created_at, id: lastCar.car_id })
    : null;

  const result = {
    cars: formattedCars,
    pagination: {
      limit: limitNum,
      next_cursor: nextCursor,
      has_more: formattedCars.length === limitNum,
    },
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
    }
  } catch (err) {
    console.error('Redis set cache error in getLeadSummary:', err);
  }

  return result;
};

/**
 * Drill-Down API: Fetch timeline of buyers for a specific car with composite cursor tie-breaker & source filter
 */
exports.getCarLeads = async (sellerId, carId, { limit = 20, cursor = null, source = null } = {}) => {
  // 1. Security Check: Verify car exists and belongs to this seller (unscoped to allow sold/deleted cars)
  const car = await Car.unscoped().findOne({
    where: { id: carId, user_id: sellerId },
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });

  if (!car) {
    throw new AppError('Car not found or you are not authorized to view these leads', 404);
  }

  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const cacheKey = `car:leads:${carId}:${source || 'all'}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getCarLeads:', err);
  }

  const whereClause = {
    car_id: carId,
  };

  if (source && source !== 'all') {
    whereClause.source = source;
  }

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

  const leads = await Lead.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'buyer',
        attributes: ['id', 'full_name', 'phone', 'email'],
      },
    ],
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limitNum,
  });

  const formattedLeads = leads.map((lead) => {
    const json = typeof lead.toJSON === 'function' ? lead.toJSON() : lead;
    const buyerName = json.buyer?.full_name || json.buyer_name || 'Anonymous';
    const buyerPhone = json.contact_phone || json.buyer?.phone || json.buyer_phone || 'N/A';

    return {
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      interacted_at: json.created_at,
      source: json.source || 'message',
    };
  });

  const lastLead = leads.length > 0 ? leads[leads.length - 1] : null;
  const nextCursor = lastLead
    ? encodeCursor({ created_at: lastLead.created_at, id: lastLead.id })
    : null;

  const carName = [car.brand?.name, car.carModel?.name].filter(Boolean).join(' ') || 'Pre-Owned Car';

  const result = {
    car_info: {
      id: car.id,
      name: carName,
      number_plate: car.number_plate,
    },
    leads: formattedLeads,
    pagination: {
      limit: limitNum,
      next_cursor: nextCursor,
      has_more: formattedLeads.length === limitNum,
    },
  };

  try {
    if (redisClient.isOpen) {
      // 30-second cache TTL for drill-down
      await redisClient.setEx(cacheKey, 30, JSON.stringify(result));
    }
  } catch (err) {
    console.error('Redis set cache error in getCarLeads:', err);
  }

  return result;
};

/**
 * Batch mark leads as read/viewed
 */
exports.batchMarkAsRead = async (sellerId, leadIds = []) => {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw new AppError('lead_ids array is required', 400);
  }

  await Lead.update(
    { is_viewed: true, read_at: new Date() },
    {
      where: {
        id: { [Op.in]: leadIds },
        seller_id: sellerId,
      },
    }
  );

  await clearCachePattern(`seller:lead_summary:${sellerId}:*`);
  await clearCachePattern(`seller:leads:${sellerId}:*`);
  await clearCachePattern(`car:leads:*`);

  return { success: true, updated_count: leadIds.length };
};

/**
 * Get leads for cars owned by the seller
 */
exports.getSellerLeads = async (sellerId, filters = {}, page = 1, limit = 20) => {
  const status = filters.status || null;
  const cursor = filters.cursor || null;
  const limitNum = parseInt(limit) || 20;
  const pageNum = parseInt(page) || 1;

  const cacheKey = `seller:leads:${sellerId}:${status || 'all'}:${cursor || pageNum}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getSellerLeads:', err);
  }

  const where = { seller_id: sellerId };
  if (cursor) {
    where.created_at = { [Op.lt]: new Date(cursor) };
  }

  const carWhere = {};
  if (status && status !== 'all') {
    carWhere.status = status;
  }

  const queryOptions = {
    where,
    include: [
      {
        model: Car,
        as: 'car',
        where: Object.keys(carWhere).length > 0 ? carWhere : undefined,
        required: Object.keys(carWhere).length > 0,
        attributes: ['id', 'year', 'price', 'status', 'number_plate', 'brand_id', 'model_id', 'variant_id', 'body_type'],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
          { model: CarStat, as: 'stats', required: false },
        ],
      },
      {
        model: User,
        as: 'buyer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: limitNum,
  };

  // If no cursor and page > 1, use offset fallback
  if (!cursor && pageNum > 1) {
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  const { count, rows } = await Lead.findAndCountAll(queryOptions);

  const formattedLeads = rows.map(formatLead);
  const lastLead = formattedLeads.length > 0 ? formattedLeads[formattedLeads.length - 1] : null;
  const next_cursor = lastLead ? (lastLead.interacted_at ? new Date(lastLead.interacted_at).toISOString() : null) : null;

  const response = {
    leads: formattedLeads,
    pagination: {
      limit: limitNum,
      page: cursor ? null : pageNum,
      total: count,
      totalPages: Math.ceil(count / limitNum),
      next_cursor,
      has_more: rows.length === limitNum,
    },
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(response));
    }
  } catch (err) {
    console.error('Redis set cache error in getSellerLeads:', err);
  }

  return response;
};

/**
 * Get enquiries made by the logged-in buyer
 */
exports.getBuyerLeads = async (buyerId, filters = {}, page = 1, limit = 20) => {
  const status = filters.status || null;
  const cursor = filters.cursor || null;
  const limitNum = parseInt(limit) || 20;
  const pageNum = parseInt(page) || 1;

  const where = { buyer_id: buyerId };
  if (cursor) {
    where.created_at = { [Op.lt]: new Date(cursor) };
  }

  const carWhere = {};
  if (status && status !== 'all') {
    carWhere.status = status;
  }

  const queryOptions = {
    where,
    include: [
      {
        model: Car,
        as: 'car',
        where: Object.keys(carWhere).length > 0 ? carWhere : undefined,
        required: Object.keys(carWhere).length > 0,
        attributes: ['id', 'year', 'price', 'status', 'number_plate', 'brand_id', 'model_id', 'variant_id', 'body_type'],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
          { model: CarStat, as: 'stats', required: false },
        ],
      },
      {
        model: User,
        as: 'seller',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: limitNum,
  };

  if (!cursor && pageNum > 1) {
    queryOptions.offset = (pageNum - 1) * limitNum;
  }

  const { count, rows } = await Lead.findAndCountAll(queryOptions);

  const formattedLeads = rows.map(formatLead);
  const lastLead = formattedLeads.length > 0 ? formattedLeads[formattedLeads.length - 1] : null;
  const next_cursor = lastLead ? (lastLead.interacted_at ? new Date(lastLead.interacted_at).toISOString() : null) : null;

  return {
    leads: formattedLeads,
    pagination: {
      limit: limitNum,
      page: cursor ? null : pageNum,
      total: count,
      totalPages: Math.ceil(count / limitNum),
      next_cursor,
      has_more: rows.length === limitNum,
    },
  };
};

/**
 * Update status of a lead (by seller or admin)
 */
exports.updateLeadStatus = async (leadId, userId, userRole, newStatus) => {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new AppError('Lead not found', 404);

  const isAdmin = userRole === 'admin';
  if (lead.seller_id !== userId && !isAdmin) {
    throw new AppError('You are not authorized to update this lead', 403);
  }

  const updateData = { status: newStatus };
  if (newStatus === 'contacted' && !lead.read_at) {
    updateData.read_at = new Date();
    updateData.is_viewed = true;
  }

  await lead.update(updateData);

  await clearCachePattern(`seller:leads:${lead.seller_id}:*`);
  await clearCachePattern(`seller:lead_summary:${lead.seller_id}:*`);
  await clearCachePattern(`car:leads:${lead.car_id}:*`);
  if (lead.buyer_id) {
    await clearCachePattern(`buyer:leads:${lead.buyer_id}:*`);
  }

  const dashboardService = require('./dashboardService');
  await dashboardService.invalidateDashboardCache(lead.seller_id);
  if (lead.buyer_id) {
    await dashboardService.invalidateDashboardCache(lead.buyer_id);
  }

  return await exports.getLeadById(lead.id);
};

/**
 * Unlock lead contact (subscription-based legacy method)
 */
exports.unlockLead = async (leadId, sellerId) => {
  const lead = await Lead.findByPk(leadId, {
    include: [{ model: Car, as: 'car' }],
  });
  if (!lead) throw new AppError('Lead not found', 404);
  if (lead.seller_id !== sellerId) throw new AppError('Unauthorized', 403);

  const subscriptionService = require('./subscriptionService');
  const hasActive = await subscriptionService.hasActiveSubscription(sellerId);
  if (!hasActive) {
    throw new AppError('Active subscription required to unlock contacts', 402);
  }

  await lead.update({ contact_unlocked: true, unlocked_at: new Date() });
  return await exports.getLeadById(lead.id);
};

/**
 * Admin: Get all leads with filters & search
 */
exports.getAllLeadsForAdmin = async (filters = {}) => {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;

  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.seller_id) {
    where.seller_id = filters.seller_id;
  }

  if (filters.car_id) {
    where.car_id = filters.car_id;
  }

  if (filters.start_date || filters.end_date) {
    where.created_at = {};
    if (filters.start_date) {
      where.created_at[Op.gte] = new Date(filters.start_date);
    }
    if (filters.end_date) {
      where.created_at[Op.lte] = new Date(filters.end_date);
    }
  }

  if (filters.search) {
    where[Op.or] = [
      { buyer_name: { [Op.like]: `%${filters.search}%` } },
      { buyer_phone: { [Op.like]: `%${filters.search}%` } },
      { buyer_email: { [Op.like]: `%${filters.search}%` } },
      { contact_phone: { [Op.like]: `%${filters.search}%` } },
    ];
  }

  const { count, rows } = await Lead.findAndCountAll({
    where,
    include: [
      {
        model: Car,
        as: 'car',
        attributes: ['id', 'year', 'price', 'status', 'brand_id', 'model_id', 'variant_id', 'body_type'],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        ],
      },
      {
        model: User,
        as: 'seller',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
      {
        model: User,
        as: 'buyer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    leads: rows.map(formatLead),
  };
};