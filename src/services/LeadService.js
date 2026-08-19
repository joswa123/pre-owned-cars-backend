// services/leadService.js
const { Lead, Car, User, Brand, Model, Variant, CarImage } = require('../models');
const { Op } = require('sequelize');
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

const formatLead = (lead) => {
  if (!lead) return null;
  const json = typeof lead.toJSON === 'function' ? lead.toJSON() : { ...lead };
  const car = json.car;
  const carFormatted = car ? {
    id: car.id,
    brand: car.brand?.name || null,
    model: car.carModel?.name || null,
    variant: car.carVariant?.name || null,
    year: car.year || null,
    price: car.price || null,
    status: car.status || null,
    primary_image: car.images?.find((i) => i.is_primary)?.image_url || car.images?.[0]?.image_url || null,
  } : null;

  return {
    id: json.id,
    car_id: json.car_id,
    seller_id: json.seller_id,
    user_id: json.buyer_id,
    buyer_id: json.buyer_id,
    car: carFormatted,
    seller: json.seller || null,
    buyer: json.buyer || {
      id: json.buyer_id,
      full_name: json.buyer_name,
      phone: json.buyer_phone,
      email: json.buyer_email,
    },
    message: json.message || null,
    contact_phone: json.contact_phone || json.buyer_phone || null,
    preferred_contact: json.preferred_contact || 'phone',
    source: json.source || 'message',
    status: json.status || 'new',
    is_viewed: json.is_viewed || false,
    read_at: json.read_at || null,
    created_at: json.created_at || json.createdAt,
    updated_at: json.updated_at || json.updatedAt,
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
  if (userId) {
    await clearCachePattern(`buyer:leads:${userId}:*`);
  }

  return await exports.getLeadById(lead.id);
};

/**
 * Get leads for cars owned by the seller
 */
exports.getSellerLeads = async (sellerId, filters = {}, page = 1, limit = 20) => {
  const cacheKey = `seller:leads:${sellerId}:${filters.status || 'all'}:${page}:${limit}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getSellerLeads:', err);
  }

  const offset = (page - 1) * limit;
  const where = { seller_id: sellerId };

  if (filters.status) {
    where.status = filters.status;
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
        as: 'buyer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const response = {
    leads: rows.map(formatLead),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit),
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
  const offset = (page - 1) * limit;
  const where = { buyer_id: buyerId };

  if (filters.status) {
    where.status = filters.status;
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
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    leads: rows.map(formatLead),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit),
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
  if (lead.buyer_id) {
    await clearCachePattern(`buyer:leads:${lead.buyer_id}:*`);
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