const {
  Lead,
  Car,
  CommercialVehicle,
  CommercialVehicleImage,
  CarType,
  User,
  Brand,
  Model,
  Variant,
  CarImage,
  CarStat,
  View,
  Wishlist,
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { AppError } = require('../utils/errorHandler');
const { resolveTarget } = require('../utils/targetResolver');
const redisClient = require('../config/redis');

const clearCachePattern = async (pattern) => {
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

const leadCarInclude = {
  model: Car.unscoped(),
  as: 'car',
  required: false,
  attributes: ['id', 'user_id', 'year', 'price', 'previous_price', 'has_price_drop', 'status', 'number_plate', 'brand_id', 'model_id', 'variant_id', 'body_type'],
  include: [
    { model: Brand, as: 'brand', attributes: ['id', 'name'] },
    { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
    { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
    { model: CarStat, as: 'stats', required: false },
  ],
};

const leadCommercialInclude = {
  model: CommercialVehicle.unscoped ? CommercialVehicle.unscoped() : CommercialVehicle,
  as: 'commercialVehicle',
  required: false,
  paranoid: false,
  attributes: ['id', 'user_id', 'year', 'price', 'status', 'brand_id', 'vehicle_type_id', 'views_count'],
  include: [
    { model: Brand, as: 'brand', attributes: ['id', 'name'] },
    { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
    { model: CommercialVehicleImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
  ],
};

const formatLead = (lead) => {
  if (!lead) return null;
  const json = typeof lead.toJSON === 'function' ? lead.toJSON() : { ...lead };
  const car = json.car;
  const carFormatted = car ? {
    id: car.id,
    user_id: car.user_id || json.seller_id || null,
    seller_id: car.user_id || json.seller_id || null,
    target_type: 'car',
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

  const commercial = json.commercialVehicle;
  const commLeads = Array.isArray(commercial?.leads) ? commercial.leads : [];
  const commCalls = commLeads.filter((l) => String(l.source || '').toLowerCase() === 'call').length;
  const commWhatsapp = commLeads.filter((l) => String(l.source || '').toLowerCase() === 'whatsapp').length;
  const commMessages = commLeads.filter((l) => ['message', 'chat'].includes(String(l.source || '').toLowerCase())).length;

  const commercialFormatted = commercial ? {
    id: commercial.id,
    user_id: commercial.user_id || json.seller_id || null,
    seller_id: commercial.user_id || json.seller_id || null,
    target_type: 'commercial',
    name: [commercial.brand?.name, commercial.vehicleType?.name, commercial.year].filter(Boolean).join(' ') || 'Commercial Vehicle',
    brand: commercial.brand?.name || null,
    model: commercial.vehicleType?.name || null,
    vehicle_type: commercial.vehicleType?.name || null,
    variant: null,
    year: commercial.year || null,
    price: commercial.price || null,
    status: commercial.status || null,
    number_plate: null,
    primary_image: commercial.images?.find((i) => i.is_primary)?.image_url || commercial.images?.[0]?.image_url || null,
    metrics: {
      views: commercial.views_count || 0,
      total_enquiries: commLeads.length || (json.target_type === 'commercial' ? 1 : 0),
      total_calls: commCalls,
      total_whatsapp: commWhatsapp,
      total_messages: commMessages,
      wishlist_count: Array.isArray(commercial.wishlists) ? commercial.wishlists.length : 0,
    },
  } : null;

  const isCommercial = json.target_type === 'commercial' || (!carFormatted && !!commercialFormatted);
  const activeVehicle = isCommercial ? commercialFormatted : carFormatted;

  const unifiedVehicle = activeVehicle ? {
    id: activeVehicle.id,
    user_id: activeVehicle.user_id || null,
    seller_id: activeVehicle.seller_id || null,
    target_type: activeVehicle.target_type,
    name: activeVehicle.name,
    brand: activeVehicle.brand,
    model: activeVehicle.model,
    variant: activeVehicle.variant || null,
    year: activeVehicle.year,
    price: activeVehicle.price,
    status: activeVehicle.status,
    primary_image: activeVehicle.primary_image,
  } : null;

  const buyerName = json.buyer?.full_name || json.buyer_name || 'Anonymous';
  const buyerPhone = json.contact_phone || json.buyer?.phone || json.buyer_phone || 'N/A';
  const buyerEmail = json.buyer?.email || json.buyer_email || null;

  return {
    id: json.id,
    target_type: json.target_type || (isCommercial ? 'commercial' : 'car'),
    target_id: json.target_id || (isCommercial ? commercialFormatted?.id : carFormatted?.id) || json.car_id,
    interaction_id: json.id,
    type: json.source || 'message',
    source: json.source || 'message',
    status: json.status || 'new',
    is_viewed: json.is_viewed || false,
    interacted_at: json.created_at || json.createdAt,
    created_at: json.created_at || json.createdAt,
    buyer_id: json.buyer_id,
    user_id: json.buyer_id,
    seller_id: json.seller_id,
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
    seller: json.seller ? {
      id: json.seller.id,
      full_name: json.seller.full_name,
      phone: json.seller.phone,
      email: json.seller.email,
      role: json.seller.role,
      city: json.seller.city || null,
      state: json.seller.state || null,
      profile_picture: json.seller.profile_picture || null,
    } : null,
    car: carFormatted, // Keep legacy field for backward compatibility
    commercial: commercialFormatted,
    vehicle: unifiedVehicle,
    is_vehicle_deleted: !activeVehicle || activeVehicle.status === 'deleted' || activeVehicle.status === null,
  };
};

/**
 * Get single lead details by ID with associations
 */
exports.getLeadById = async (leadId) => {
  const lead = await Lead.findByPk(leadId, {
    include: [
      leadCarInclude,
      leadCommercialInclude,
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
  const targetId = data.target_id || data.car_id || data.carId || data.commercial_id || data.commercialId;
  if (!targetId) throw new AppError('target_id or car_id is required', 400);

  let rawType = (data.target_type || (data.commercial_id || data.commercialId ? 'commercial' : null)) ? String(data.target_type || (data.commercial_id || data.commercialId ? 'commercial' : '')).toLowerCase() : null;
  let car = null;
  let commercialVehicle = null;
  let sellerId = null;
  let targetType = rawType;

  // Auto-detect targetType if not specified or check if target exists in opposite table
  if (targetType === 'commercial') {
    commercialVehicle = await resolveTarget('commercial', targetId);
    if (!commercialVehicle) {
      // Check if it's actually a car
      car = await Car.findByPk(targetId);
      if (car) {
        targetType = 'car';
      } else {
        throw new AppError('Commercial vehicle not found', 404);
      }
    }
  } else if (targetType === 'car') {
    car = await Car.findByPk(targetId);
    if (!car) {
      // Check if it's actually a commercial vehicle
      commercialVehicle = await resolveTarget('commercial', targetId);
      if (commercialVehicle) {
        targetType = 'commercial';
      } else {
        throw new AppError('Car not found', 404);
      }
    }
  } else {
    // No target_type specified - auto-detect by querying tables
    car = await Car.findByPk(targetId);
    if (car) {
      targetType = 'car';
    } else {
      commercialVehicle = await resolveTarget('commercial', targetId);
      if (commercialVehicle) {
        targetType = 'commercial';
      } else {
        throw new AppError('Vehicle not found', 404);
      }
    }
  }

  if (targetType === 'commercial' && commercialVehicle) {
    if (commercialVehicle.status !== 'active') {
      throw new AppError('Commercial vehicle is not available for enquiry', 400);
    }
    if (commercialVehicle.user_id === userId) {
      throw new AppError('Cannot enquire on your own commercial vehicle listing', 400);
    }
    sellerId = commercialVehicle.user_id;
  } else if (car) {
    if (car.status !== 'active') throw new AppError('Car is not available for enquiry', 400);
    if (car.user_id === userId) {
      throw new AppError('Cannot enquire on your own car listing', 400);
    }
    sellerId = car.user_id;
  }

  let buyer = null;
  if (userId) {
    buyer = await User.findByPk(userId);
  } else {
    if (!data.name || !data.phone) {
      throw new AppError('Name and phone are required for guest enquiries', 400);
    }
  }

  const buyerName = data.name || buyer?.full_name || 'Guest User';
  const buyerPhone = data.contact_phone || data.phone || buyer?.phone || '';
  const buyerEmail = data.email || buyer?.email || null;

  const lead = await Lead.create({
    car_id: targetType === 'car' ? targetId : null,
    target_type: targetType,
    target_id: targetId,
    seller_id: sellerId,
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

  await clearCachePattern(`seller:leads:${sellerId}:*`);
  await clearCachePattern(`seller:lead_summary:${sellerId}:*`);
  if (targetType === 'car' && car) {
    await clearCachePattern(`car:leads:${car.id}:*`);
  } else if (targetType === 'commercial' && commercialVehicle) {
    await clearCachePattern(`car:leads:${commercialVehicle.id}:*`);
  }
  if (userId) {
    await clearCachePattern(`buyer:leads:${userId}:*`);
  }

  const dashboardService = require('./dashboardService');
  await dashboardService.invalidateDashboardCache(sellerId);
  if (userId) {
    await dashboardService.invalidateDashboardCache(userId);
  }

  // Synchronize with Analytics Engine (Redis Buffer + car_stats)
  if (targetType === 'car' && car) {
    try {
      const analyticsService = require('./analyticsService');
      const interactionType = ['call', 'whatsapp', 'message'].includes(data.source) ? data.source : 'message';
      await analyticsService.recordInteraction({
        carId: car.id,
        userId: userId || null,
        type: interactionType,
      });
    } catch (statErr) {
      console.warn('Lead analytics synchronization warning:', statErr.message);
    }
  }

  return await exports.getLeadById(lead.id);
};

/**
 * Summary API: Cars grouped by lead stats with cursor pagination & Redis cache
 */
exports.getLeadSummary = async (sellerId, { status = null, limit = 20, cursor = null, target_type = null, type = null, targetType = null, include_deleted = null, includeDeleted = null } = {}) => {
  const rawTargetType = target_type || type || targetType || null;
  const resolvedTarget = (rawTargetType && rawTargetType !== 'all') ? rawTargetType.toLowerCase() : null;
  const limitNum = Math.min(parseInt(limit) || 20, 100);

  const rawIncludeDeleted = include_deleted !== null ? include_deleted : includeDeleted;
  const isIncludeDeleted = String(rawIncludeDeleted || '').toLowerCase() === 'true';
  const isOnlyDeleted = String(rawIncludeDeleted || '').toLowerCase() === 'only';

  const cacheKey = `seller:lead_summary:${sellerId}:${status || 'all'}:${resolvedTarget || 'all'}:${rawIncludeDeleted || 'false'}:${cursor || 'first'}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getLeadSummary:', err);
  }

  const carWhere = { user_id: sellerId };
  const commWhere = { user_id: sellerId };
  if (isOnlyDeleted) {
    carWhere.status = 'deleted';
    commWhere.status = 'deleted';
  } else if (isIncludeDeleted) {
    if (status && status !== 'all') {
      carWhere.status = status.toLowerCase();
      commWhere.status = status.toLowerCase();
    }
  } else {
    if (status && status !== 'all') {
      carWhere.status = status.toLowerCase();
      commWhere.status = status.toLowerCase();
    } else {
      carWhere.status = { [Op.ne]: 'deleted' };
      commWhere.status = { [Op.ne]: 'deleted' };
    }
  }

  const shouldFetchCars = !resolvedTarget || resolvedTarget === 'car';
  const shouldFetchCommercial = !resolvedTarget || resolvedTarget === 'commercial';

  const [cars, commercialVehicles] = await Promise.all([
    shouldFetchCars
      ? Car.unscoped().findAll({
          where: carWhere,
          attributes: ['id', 'brand_id', 'model_id', 'variant_id', 'price', 'number_plate', 'status', 'created_at'],
          include: [
            { model: Brand, as: 'brand', attributes: ['id', 'name'] },
            { model: Model, as: 'carModel', attributes: ['id', 'name'] },
            { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
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
        })
      : Promise.resolve([]),
    shouldFetchCommercial
      ? CommercialVehicle.findAll({
          where: commWhere,
          attributes: ['id', 'brand_id', 'vehicle_type_id', 'price', 'status', 'views_count', 'year', 'created_at'],
          include: [
            { model: Brand, as: 'brand', attributes: ['id', 'name'] },
            { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
            {
              model: CommercialVehicleImage,
              as: 'images',
              attributes: ['id', 'image_url', 'is_primary'],
              required: false,
            },
          ],
          order: [
            ['created_at', 'DESC'],
            ['id', 'DESC'],
          ],
        })
      : Promise.resolve([]),
  ]);

  const unifiedList = [
    ...cars.map((c) => {
      const json = typeof c.toJSON === 'function' ? c.toJSON() : c;
      const nameParts = [json.brand?.name, json.carModel?.name, json.carVariant?.name].filter(Boolean);
      return {
        id: json.id,
        target_type: 'car',
        name: nameParts.length > 0 ? nameParts.join(' ') : 'Pre-Owned Car',
        price: json.price,
        number_plate: json.number_plate,
        status: json.status,
        primary_image: json.images?.find((img) => img.is_primary)?.image_url || json.images?.[0]?.image_url || null,
        stats: json.stats || {},
        created_at: json.created_at,
      };
    }),
    ...commercialVehicles.map((cv) => {
      const json = typeof cv.toJSON === 'function' ? cv.toJSON() : cv;
      const nameParts = [json.brand?.name, json.vehicleType?.name, json.year].filter(Boolean);
      return {
        id: json.id,
        target_type: 'commercial',
        name: nameParts.length > 0 ? nameParts.join(' ') : 'Commercial Vehicle',
        price: json.price,
        number_plate: null,
        status: json.status,
        primary_image: json.images?.find((img) => img.is_primary)?.image_url || json.images?.[0]?.image_url || null,
        stats: { views_count: json.views_count || 0 },
        created_at: json.created_at,
      };
    }),
  ];

  // Sort unified list descending by created_at then id
  unifiedList.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return String(b.id).localeCompare(String(a.id));
  });

  let pagedVehicles = unifiedList;
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    const cursorTime = new Date(decodedCursor.created_at).getTime();
    const cursorId = decodedCursor.id;
    pagedVehicles = unifiedList.filter((v) => {
      const vTime = new Date(v.created_at).getTime();
      if (vTime < cursorTime) return true;
      if (vTime === cursorTime && cursorId && String(v.id) < String(cursorId)) return true;
      return false;
    });
  }

  const pageSlice = pagedVehicles.slice(0, limitNum);
  const vehicleIds = pageSlice.map((v) => v.id);

  let leadMap = {};
  let viewMap = {};
  let wishlistMap = {};

  if (vehicleIds.length > 0) {
    const [leadStats, viewStats, wishlistStats] = await Promise.all([
      Lead.findAll({
        attributes: [
          'target_id',
          'car_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_leads'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'call' THEN 1 ELSE 0 END")), 'calls'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) = 'whatsapp' THEN 1 ELSE 0 END")), 'whatsapp'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) IN ('message', 'chat') THEN 1 ELSE 0 END")), 'messages'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN LOWER(source) NOT IN ('call', 'whatsapp', 'message', 'chat') THEN 1 ELSE 0 END")), 'other_enquiries'],
        ],
        where: {
          [Op.or]: [
            { target_id: { [Op.in]: vehicleIds } },
            { car_id: { [Op.in]: vehicleIds } },
          ],
        },
        group: ['target_id', 'car_id'],
        raw: true,
      }),
      View.findAll({
        attributes: [
          'target_id',
          'car_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'views_count'],
        ],
        where: {
          [Op.or]: [
            { target_id: { [Op.in]: vehicleIds } },
            { car_id: { [Op.in]: vehicleIds } },
          ],
        },
        group: ['target_id', 'car_id'],
        raw: true,
      }),
      Wishlist.findAll({
        attributes: [
          'target_id',
          'car_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'wishlist_count'],
        ],
        where: {
          [Op.or]: [
            { target_id: { [Op.in]: vehicleIds } },
            { car_id: { [Op.in]: vehicleIds } },
          ],
        },
        group: ['target_id', 'car_id'],
        raw: true,
      }),
    ]);

    leadStats.forEach((l) => {
      const key = l.target_id || l.car_id;
      if (!leadMap[key]) {
        leadMap[key] = { total: 0, calls: 0, whatsapp: 0, messages: 0, other: 0 };
      }
      leadMap[key].total += parseInt(l.total_leads, 10) || 0;
      leadMap[key].calls += parseInt(l.calls, 10) || 0;
      leadMap[key].whatsapp += parseInt(l.whatsapp, 10) || 0;
      leadMap[key].messages += parseInt(l.messages, 10) || 0;
      leadMap[key].other += parseInt(l.other_enquiries, 10) || 0;
    });

    viewStats.forEach((v) => {
      const key = v.target_id || v.car_id;
      viewMap[key] = (viewMap[key] || 0) + (parseInt(v.views_count, 10) || 0);
    });

    wishlistStats.forEach((w) => {
      const key = w.target_id || w.car_id;
      wishlistMap[key] = (wishlistMap[key] || 0) + (parseInt(w.wishlist_count, 10) || 0);
    });
  }

  const formattedVehicles = pageSlice.map((v) => {
    const stats = v.stats || {};
    const lData = leadMap[v.id] || { total: 0, calls: 0, whatsapp: 0, messages: 0, other: 0 };
    const dbViews = viewMap[v.id] || 0;
    const dbWishlist = wishlistMap[v.id] || 0;

    const calls = lData.calls;
    const whatsapp = lData.whatsapp;
    const messages = lData.messages;
    const other = lData.other;
    const totalLeadCount = lData.total;
    const views = stats.views_count !== undefined ? Math.max(dbViews, stats.views_count) : dbViews;
    const wishlist = dbWishlist;
    const enquiries = other;

    return {
      car_id: v.id,
      id: v.id,
      target_id: v.id,
      target_type: v.target_type,
      name: v.name,
      price: v.price,
      number_plate: v.number_plate || null,
      status: v.status,
      is_vehicle_deleted: v.status === 'deleted',
      primary_image: v.primary_image,
      total_lead_count: totalLeadCount,
      breakdown: {
        calls,
        whatsapp,
        messages,
        enquiries,
        views,
        wishlist,
      },
      created_at: v.created_at,
    };
  });

  let totalCalls = 0;
  let totalWhatsapp = 0;
  let totalMessages = 0;
  let totalOther = 0;
  let totalLeads = 0;
  let totalViews = 0;
  let totalWishlist = 0;
  let activeInventoryLeads = 0;
  let deletedInventoryLeads = 0;
  let totalCarLeads = 0;
  let totalCommLeads = 0;

  formattedVehicles.forEach((v) => {
    const b = v.breakdown || {};
    totalCalls += b.calls || 0;
    totalWhatsapp += b.whatsapp || 0;
    totalMessages += b.messages || 0;
    totalOther += b.enquiries || 0;
    totalLeads += v.total_lead_count || 0;
    totalViews += b.views || 0;
    totalWishlist += b.wishlist || 0;
    if (v.status === 'deleted') {
      deletedInventoryLeads += v.total_lead_count || 0;
    } else {
      activeInventoryLeads += v.total_lead_count || 0;
    }
    if (v.target_type === 'commercial') {
      totalCommLeads += v.total_lead_count || 0;
    } else {
      totalCarLeads += v.total_lead_count || 0;
    }
  });

  if (!isIncludeDeleted && !isOnlyDeleted) {
    try {
      const delLeadCount = await Lead.count({
        where: {
          seller_id: sellerId,
          [Op.and]: [
            sequelize.literal("((Lead.target_type = 'commercial' AND EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
          ],
        },
      });
      deletedInventoryLeads = delLeadCount;
    } catch (e) {
      console.error('Error fetching deleted leads count in getLeadSummary:', e);
    }
  }

  const lastVehicle = formattedVehicles.length > 0 ? formattedVehicles[formattedVehicles.length - 1] : null;
  const nextCursor = lastVehicle
    ? encodeCursor({ created_at: lastVehicle.created_at, id: lastVehicle.id })
    : null;

  const result = {
    summary: {
      total_leads: isIncludeDeleted ? (activeInventoryLeads + deletedInventoryLeads) : (isOnlyDeleted ? deletedInventoryLeads : activeInventoryLeads),
      active_inventory: activeInventoryLeads,
      deleted_inventory: deletedInventoryLeads,
      by_source: {
        call: totalCalls,
        whatsapp: totalWhatsapp,
        message: totalMessages,
        other: totalOther,
      },
      by_target: {
        car: totalCarLeads,
        commercial: totalCommLeads,
      },
      calls: totalCalls,
      whatsapp: totalWhatsapp,
      messages: totalMessages,
      views: totalViews,
      wishlist: totalWishlist,
    },
    cars: formattedVehicles, // legacy array key for existing clients
    vehicles: formattedVehicles, // unified array key
    pagination: {
      limit: limitNum,
      next_cursor: nextCursor,
      has_more: pagedVehicles.length > limitNum,
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
 * Drill-Down API: Fetch timeline of buyers for a specific car or commercial vehicle
 */
exports.getCarLeads = async (sellerId, carId, { limit = 20, cursor = null, source = null } = {}) => {
  // 1. Security Check: Verify vehicle exists and belongs to this seller (unscoped to allow sold/deleted cars)
  let car = await Car.unscoped().findOne({
    where: { id: carId, user_id: sellerId },
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });

  let commercial = null;
  let targetType = 'car';

  if (!car) {
    commercial = await CommercialVehicle.findOne({
      where: { id: carId, user_id: sellerId },
      paranoid: false,
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      ],
    });
    if (commercial) {
      targetType = 'commercial';
    }
  }

  if (!car && !commercial) {
    throw new AppError('Vehicle not found or you are not authorized to view these leads', 404);
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
    [Op.or]: [
      { target_id: carId },
      { car_id: carId },
    ],
  };

  const allowedSources = ['whatsapp', 'call', 'message'];
  if (source && allowedSources.includes(source)) {
    whereClause.source = source;
  } else if (source) {
    throw new AppError('Invalid source filter. Allowed: whatsapp, call, message', 400);
  }

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    if (decodedCursor.id) {
      whereClause[Op.and] = [
        {
          [Op.or]: [
            { created_at: { [Op.lt]: new Date(decodedCursor.created_at) } },
            {
              created_at: new Date(decodedCursor.created_at),
              id: { [Op.lt]: decodedCursor.id },
            },
          ],
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
    const buyerEmail = json.buyer?.email || json.buyer_email || null;

    return {
      id: json.id,
      lead_id: json.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      buyer_email: buyerEmail,
      message: json.message || null,
      status: json.status || 'new',
      interacted_at: json.created_at,
      source: json.source || 'message',
    };
  });

  const lastLead = leads.length > 0 ? leads[leads.length - 1] : null;
  const nextCursor = lastLead
    ? encodeCursor({ created_at: lastLead.created_at, id: lastLead.id })
    : null;

  const vehicleName = car
    ? ([car.brand?.name, car.carModel?.name].filter(Boolean).join(' ') || 'Pre-Owned Car')
    : ([commercial.brand?.name, commercial.vehicleType?.name, commercial.year].filter(Boolean).join(' ') || 'Commercial Vehicle');

  const vehicleInfo = {
    id: car ? car.id : commercial.id,
    target_type: targetType,
    name: vehicleName,
    number_plate: car?.number_plate || null,
  };

  const result = {
    target_type: targetType,
    car_info: vehicleInfo, // 100% backward compatibility
    vehicle_info: vehicleInfo,
    commercial_info: targetType === 'commercial' ? vehicleInfo : null,
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
  const rawTargetType = filters.target_type || filters.type || filters.targetType || null;
  const targetType = (rawTargetType && rawTargetType !== 'all') ? rawTargetType.toLowerCase() : null;
  const limitNum = parseInt(limit) || 20;
  const pageNum = parseInt(page) || 1;

  const rawIncludeDeleted = filters.include_deleted !== undefined ? filters.include_deleted : filters.includeDeleted;
  const isOnlyDeleted = String(rawIncludeDeleted || '').toLowerCase() === 'only';
  const isExcludeDeleted = String(rawIncludeDeleted || '').toLowerCase() === 'false';

  const cacheKey = `seller:leads:${sellerId}:${status || 'all'}:${targetType || 'all'}:${rawIncludeDeleted || 'all'}:${cursor || pageNum}:${limitNum}`;

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
  if (targetType) {
    if (targetType === 'commercial') {
      where.target_type = 'commercial';
    } else if (targetType === 'car') {
      where[Op.or] = [{ target_type: 'car' }, { target_type: null }];
    } else {
      where.target_type = targetType;
    }
  }
  if (status && status !== 'all') {
    where.status = status;
  }

  if (isOnlyDeleted) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.literal("((Lead.target_type = 'commercial' AND EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
    );
  } else if (isExcludeDeleted) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.literal("((Lead.target_type = 'commercial' AND NOT EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
    );
  }

  const queryOptions = {
    where,
    distinct: true,
    col: 'id',
    include: [
      leadCarInclude,
      leadCommercialInclude,
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

  const [sourceStats, targetStats, activeCount, deletedCount, { count, rows }] = await Promise.all([
    Lead.findAll({
      where: {
        seller_id: sellerId,
        ...(where.target_type ? { target_type: where.target_type } : {}),
        ...(where[Op.or] ? { [Op.or]: where[Op.or] } : {}),
        ...(where[Op.and] ? { [Op.and]: where[Op.and] } : {}),
        ...(where.status ? { status: where.status } : {}),
      },
      attributes: ['source', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source'],
      raw: true,
    }),
    Lead.findAll({
      where: {
        seller_id: sellerId,
        ...(where.target_type ? { target_type: where.target_type } : {}),
        ...(where[Op.or] ? { [Op.or]: where[Op.or] } : {}),
        ...(where[Op.and] ? { [Op.and]: where[Op.and] } : {}),
        ...(where.status ? { status: where.status } : {}),
      },
      attributes: ['target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['target_type'],
      raw: true,
    }),
    Lead.count({
      where: {
        seller_id: sellerId,
        [Op.and]: [
          sequelize.literal("((Lead.target_type = 'commercial' AND NOT EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
        ],
      },
    }),
    Lead.count({
      where: {
        seller_id: sellerId,
        [Op.and]: [
          sequelize.literal("((Lead.target_type = 'commercial' AND EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
        ],
      },
    }),
    Lead.findAndCountAll(queryOptions),
  ]);

  const summary = {
    total: count,
    active_inventory: activeCount,
    deleted_inventory: deletedCount,
    by_source: {
      call: 0,
      whatsapp: 0,
      message: 0,
    },
    by_target: {
      car: 0,
      commercial: 0,
    },
  };
  sourceStats.forEach((r) => {
    const src = (r.source || 'message').toLowerCase();
    const c = parseInt(r.count, 10) || 0;
    if (summary.by_source[src] !== undefined) {
      summary.by_source[src] += c;
    } else {
      summary.by_source[src] = c;
    }
  });

  targetStats.forEach((r) => {
    const tgt = (r.target_type || 'car').toLowerCase();
    const c = parseInt(r.count, 10) || 0;
    if (summary.by_target[tgt] !== undefined) {
      summary.by_target[tgt] += c;
    } else {
      summary.by_target[tgt] = c;
    }
  });

  const formattedLeads = rows.map(formatLead);
  const lastLead = formattedLeads.length > 0 ? formattedLeads[formattedLeads.length - 1] : null;
  const next_cursor = lastLead ? (lastLead.interacted_at ? new Date(lastLead.interacted_at).toISOString() : null) : null;

  const response = {
    summary,
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
  const rawTargetType = filters.target_type || filters.type || filters.targetType || null;
  const targetType = (rawTargetType && rawTargetType !== 'all') ? rawTargetType.toLowerCase() : null;
  const limitNum = parseInt(limit) || 20;
  const pageNum = parseInt(page) || 1;

  const rawIncludeDeleted = filters.include_deleted !== undefined ? filters.include_deleted : filters.includeDeleted;
  const isOnlyDeleted = String(rawIncludeDeleted || '').toLowerCase() === 'only';
  const isExcludeDeleted = String(rawIncludeDeleted || '').toLowerCase() === 'false';

  const cacheKey = `buyer:leads:${buyerId}:${status || 'all'}:${targetType || 'all'}:${rawIncludeDeleted || 'all'}:${cursor || pageNum}:${limitNum}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getBuyerLeads:', err);
  }

  const where = { buyer_id: buyerId };
  if (cursor) {
    where.created_at = { [Op.lt]: new Date(cursor) };
  }
  if (targetType) {
    if (targetType === 'commercial') {
      where.target_type = 'commercial';
    } else if (targetType === 'car') {
      where[Op.or] = [{ target_type: 'car' }, { target_type: null }];
    } else {
      where.target_type = targetType;
    }
  }
  if (status && status !== 'all') {
    where.status = status;
  }

  if (isOnlyDeleted) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.literal("((Lead.target_type = 'commercial' AND EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
    );
  } else if (isExcludeDeleted) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(
      sequelize.literal("((Lead.target_type = 'commercial' AND NOT EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
    );
  }

  const queryOptions = {
    where,
    distinct: true,
    col: 'id',
    include: [
      leadCarInclude,
      leadCommercialInclude,
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

  const [sourceStats, targetStats, activeCount, deletedCount, { count, rows }] = await Promise.all([
    Lead.findAll({
      where: {
        buyer_id: buyerId,
        ...(where.target_type ? { target_type: where.target_type } : {}),
        ...(where[Op.or] ? { [Op.or]: where[Op.or] } : {}),
        ...(where[Op.and] ? { [Op.and]: where[Op.and] } : {}),
        ...(where.status ? { status: where.status } : {}),
      },
      attributes: ['source', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source'],
      raw: true,
    }),
    Lead.findAll({
      where: {
        buyer_id: buyerId,
        ...(where.target_type ? { target_type: where.target_type } : {}),
        ...(where[Op.or] ? { [Op.or]: where[Op.or] } : {}),
        ...(where[Op.and] ? { [Op.and]: where[Op.and] } : {}),
        ...(where.status ? { status: where.status } : {}),
      },
      attributes: ['target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['target_type'],
      raw: true,
    }),
    Lead.count({
      where: {
        buyer_id: buyerId,
        [Op.and]: [
          sequelize.literal("((Lead.target_type = 'commercial' AND NOT EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
        ],
      },
    }),
    Lead.count({
      where: {
        buyer_id: buyerId,
        [Op.and]: [
          sequelize.literal("((Lead.target_type = 'commercial' AND EXISTS (SELECT 1 FROM commercial_vehicles cv WHERE cv.id = Lead.target_id AND (cv.status = 'deleted' OR cv.deleted_at IS NOT NULL))) OR (COALESCE(Lead.target_type, 'car') = 'car' AND EXISTS (SELECT 1 FROM cars c WHERE c.id = COALESCE(Lead.car_id, Lead.target_id) AND (c.status = 'deleted' OR c.deleted_at IS NOT NULL))))")
        ],
      },
    }),
    Lead.findAndCountAll(queryOptions),
  ]);

  const summary = {
    total: count,
    active_inventory: activeCount,
    deleted_inventory: deletedCount,
    by_source: {
      call: 0,
      whatsapp: 0,
      message: 0,
    },
    by_target: {
      car: 0,
      commercial: 0,
    },
  };
  sourceStats.forEach((r) => {
    const src = (r.source || 'message').toLowerCase();
    const c = parseInt(r.count, 10) || 0;
    if (summary.by_source[src] !== undefined) {
      summary.by_source[src] += c;
    } else {
      summary.by_source[src] = c;
    }
  });

  targetStats.forEach((r) => {
    const tgt = (r.target_type || 'car').toLowerCase();
    const c = parseInt(r.count, 10) || 0;
    if (summary.by_target[tgt] !== undefined) {
      summary.by_target[tgt] += c;
    } else {
      summary.by_target[tgt] = c;
    }
  });

  const formattedLeads = rows.map(formatLead);
  const lastLead = formattedLeads.length > 0 ? formattedLeads[formattedLeads.length - 1] : null;
  const next_cursor = lastLead ? (lastLead.interacted_at ? new Date(lastLead.interacted_at).toISOString() : null) : null;

  const response = {
    summary,
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
    console.error('Redis set cache error in getBuyerLeads:', err);
  }

  return response;
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

  const rawTargetType = filters.target_type || filters.type || filters.targetType || null;
  const targetType = (rawTargetType && rawTargetType !== 'all') ? rawTargetType.toLowerCase() : null;
  if (targetType) {
    if (targetType === 'commercial') {
      where.target_type = 'commercial';
    } else if (targetType === 'car') {
      where[Op.or] = [{ target_type: 'car' }, { target_type: null }];
    } else {
      where.target_type = targetType;
    }
  }

  const vehicleId = filters.target_id || filters.car_id;
  if (vehicleId) {
    where[Op.or] = [{ car_id: vehicleId }, { target_id: vehicleId }];
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
      leadCarInclude,
      leadCommercialInclude,
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