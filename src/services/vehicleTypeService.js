'use strict';

const { Op } = require('sequelize');
const { VehicleType, Category, Brand, BrandType, Car } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const { generateUniqueSlug } = require('../utils/slugify');
const cloudinaryHelper = require('../utils/cloudinaryHelper');
const logger = require('../utils/logger');

const CACHE_KEY_PUBLIC_TYPES = 'types:v1:list';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Invalidate all Redis cache keys related to vehicle types and brands
 */
async function invalidateVehicleTypeCache() {
  try {
    if (!redisClient || !redisClient.isOpen) return;

    const patterns = [
      '__express__/api/v1/types*',
      '__express__/api/types*',
      '__express__/api/v1/car-types*',
      '__express__/api/car-types*',
      'types:v1:*',
      'car-types:v2:*',
      'catalog:brands*',
      'brands:with_counts',
    ];

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    }
    logger.info('✅ Vehicle types & brands Redis cache invalidated.');
  } catch (err) {
    logger.warn(`[Redis Cache Invalidation Warning] ${err.message}`);
  }
}

/**
 * Format VehicleType presentation
 */
function formatVehicleType(item, isAdmin = false) {
  if (!item) return null;
  const raw = typeof item.toJSON === 'function' ? item.toJSON() : item;

  const base = {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    icon_url: raw.icon_url || null,
    order: raw.order !== undefined ? raw.order : 999,
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    category_id: raw.category_id || null,
    category: raw.category ? {
      id: raw.category.id,
      name: raw.category.name,
      slug: raw.category.slug,
    } : null,
  };

  if (raw.brands) {
    base.brands = raw.brands.map(b => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo_url: b.logo || b.logo_url || null,
      is_active: Boolean(b.is_active),
    }));
  }

  if (isAdmin) {
    base.image_public_id = raw.image_public_id || null;
    base.created_at = raw.created_at;
    base.updated_at = raw.updated_at;
  }

  return base;
}

/**
 * Get all vehicle types
 * Supports category filtering (?category_id=... or ?category=commercial|car)
 */
exports.getAllVehicleTypes = async (options = {}) => {
  const { includeInactive = false, isAdmin = false, categoryId = null, categorySlug = null } = options;

  const cacheKey = `${CACHE_KEY_PUBLIC_TYPES}:${includeInactive ? 'admin' : 'pub'}:${categoryId || 'all'}:${categorySlug || 'all'}`;

  // Try Redis cache for public listings
  if (!includeInactive && !isAdmin && redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn(`[Redis Cache Read Warning] ${err.message}`);
    }
  }

  const where = {};
  if (!includeInactive) {
    where.is_active = true;
  }

  if (categoryId) {
    where.category_id = categoryId;
  }

  const categoryInclude = {
    model: Category,
    as: 'category',
    attributes: ['id', 'name', 'slug'],
  };

  if (categorySlug) {
    categoryInclude.where = { slug: categorySlug.toLowerCase() };
  }

  const types = await VehicleType.findAll({
    where,
    include: [categoryInclude],
    order: [
      ['order', 'ASC'],
      ['name', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const formatted = types.map((t) => formatVehicleType(t, isAdmin));

  // Set cache for public active list
  if (!includeInactive && !isAdmin && redisClient && redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(formatted));
    } catch (err) {
      logger.warn(`[Redis Cache Write Warning] ${err.message}`);
    }
  }

  return formatted;
};

/**
 * Find a single vehicle type by identifier (UUID or slug)
 */
exports.getVehicleTypeByIdentifier = async (identifier, options = {}) => {
  const idStr = String(identifier || '').trim();
  if (!idStr) {
    throw new AppError('Vehicle type identifier is required', 400);
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

  let vehicleType = null;
  const include = [
    { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
    {
      model: Brand,
      as: 'brands',
      attributes: ['id', 'name', 'slug', 'logo', 'is_active'],
      through: { attributes: [] },
      where: options.isAdmin ? {} : { is_active: true },
      required: false,
    },
  ];

  if (isUuid) {
    vehicleType = await VehicleType.findOne({ where: { id: idStr }, include });
  } else {
    vehicleType = await VehicleType.findOne({ where: { slug: idStr.toLowerCase() }, include });
  }

  if (!vehicleType) {
    throw new AppError(`Vehicle type not found for identifier: ${idStr}`, 404);
  }

  return formatVehicleType(vehicleType, Boolean(options.isAdmin));
};

/**
 * Create a new vehicle type (Admin)
 */
exports.createVehicleType = async (data = {}, uploadedFile = null, adminUser = null) => {
  const name = String(data.name || '').trim();
  if (!name) {
    throw new AppError('Vehicle type name is required', 400);
  }

  // Check name uniqueness
  const existingName = await VehicleType.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      name.toLowerCase()
    ),
  });
  if (existingName) {
    throw new AppError(`Vehicle type with name "${name}" already exists`, 409);
  }

  // Validate category_id if provided
  let categoryId = data.category_id ? String(data.category_id).trim() : null;
  if (categoryId) {
    const cat = await Category.findByPk(categoryId);
    if (!cat) {
      throw new AppError(`Category with ID ${categoryId} not found`, 400);
    }
  }

  // Generate unique slug
  const slug = data.slug
    ? String(data.slug).trim().toLowerCase()
    : await generateUniqueSlug(VehicleType, name);

  const existingSlug = await VehicleType.findOne({ where: { slug } });
  if (existingSlug) {
    throw new AppError(`Vehicle type slug "${slug}" is already in use`, 409);
  }

  let iconUrl = data.icon_url || null;
  let imagePublicId = null;

  if (uploadedFile) {
    try {
      const uploadResult = await cloudinaryHelper.uploadCategoryIcon(
        uploadedFile.buffer,
        slug,
        uploadedFile.mimetype
      );
      iconUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    } catch (uploadError) {
      logger.error('Failed to upload vehicle type icon to Cloudinary:', uploadError);
      throw new AppError('Failed to upload vehicle type icon to image storage', 502);
    }
  }

  const order = data.order !== undefined ? parseInt(data.order, 10) : 999;
  const isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;

  const created = await VehicleType.create({
    name,
    slug,
    icon_url: iconUrl,
    image_public_id: imagePublicId,
    order: isNaN(order) ? 999 : order,
    is_active: isActive,
    category_id: categoryId,
  });

  await invalidateVehicleTypeCache();
  logger.info(`Admin [${adminUser?.id || 'system'}] created VehicleType [${created.id}] "${created.name}"`);

  return formatVehicleType(created, true);
};

/**
 * Update an existing vehicle type (Admin)
 */
exports.updateVehicleType = async (id, data = {}, uploadedFile = null, adminUser = null) => {
  const vehicleType = await VehicleType.findByPk(id);
  if (!vehicleType) {
    throw new AppError(`Vehicle type with ID "${id}" not found`, 404);
  }

  const updates = {};

  if (data.name !== undefined) {
    const trimmedName = String(data.name).trim();
    if (!trimmedName) throw new AppError('Vehicle type name cannot be empty', 400);

    const duplicate = await VehicleType.findOne({
      where: {
        id: { [Op.ne]: vehicleType.id },
        name: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          trimmedName.toLowerCase()
        ),
      },
    });
    if (duplicate) {
      throw new AppError(`Vehicle type name "${trimmedName}" is already taken by another type`, 409);
    }
    updates.name = trimmedName;

    if (!data.slug) {
      updates.slug = await generateUniqueSlug(VehicleType, trimmedName, vehicleType.id);
    }
  }

  if (data.slug !== undefined) {
    const trimmedSlug = String(data.slug).trim().toLowerCase();
    const slugConflict = await VehicleType.findOne({
      where: {
        id: { [Op.ne]: vehicleType.id },
        slug: trimmedSlug,
      },
    });
    if (slugConflict) {
      throw new AppError(`Vehicle type slug "${trimmedSlug}" is already in use`, 409);
    }
    updates.slug = trimmedSlug;
  }

  if (data.category_id !== undefined) {
    const catId = data.category_id ? String(data.category_id).trim() : null;
    if (catId) {
      const cat = await Category.findByPk(catId);
      if (!cat) throw new AppError(`Category with ID ${catId} not found`, 400);
    }
    updates.category_id = catId;
  }

  if (data.order !== undefined) {
    const orderNum = parseInt(data.order, 10);
    updates.order = isNaN(orderNum) ? 999 : orderNum;
  }

  if (data.is_active !== undefined) {
    updates.is_active = Boolean(data.is_active);
  }

  if (uploadedFile) {
    try {
      if (vehicleType.image_public_id) {
        await cloudinaryHelper.deleteImage(vehicleType.image_public_id).catch(() => {});
      }
      const slugForUpload = updates.slug || vehicleType.slug;
      const uploadResult = await cloudinaryHelper.uploadCategoryIcon(
        uploadedFile.buffer,
        slugForUpload,
        uploadedFile.mimetype
      );
      updates.icon_url = uploadResult.secure_url;
      updates.image_public_id = uploadResult.public_id;
    } catch (uploadError) {
      logger.error('Failed to update vehicle type icon on Cloudinary:', uploadError);
      throw new AppError('Failed to upload new vehicle type icon', 502);
    }
  } else if (data.icon_url !== undefined) {
    updates.icon_url = data.icon_url || null;
  }

  await vehicleType.update(updates);
  await invalidateVehicleTypeCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] updated VehicleType [${vehicleType.id}] "${vehicleType.name}"`);
  return formatVehicleType(vehicleType, true);
};

/**
 * Delete a vehicle type (Admin - Soft delete default, safety checks)
 */
exports.deleteVehicleType = async (id, adminUser = null) => {
  const vehicleType = await VehicleType.findByPk(id);
  if (!vehicleType) {
    throw new AppError(`Vehicle type with ID "${id}" not found`, 404);
  }

  // Safety check: verify if active cars use this body_type
  const activeCarCount = await Car.count({
    where: {
      body_type: vehicleType.name,
      status: 'active',
    },
  });

  if (activeCarCount > 0) {
    // Soft delete to protect catalog integrity
    await vehicleType.update({ is_active: false });
    await invalidateVehicleTypeCache();
    logger.warn(`VehicleType [${id}] "${vehicleType.name}" has ${activeCarCount} active cars. Soft deleted (is_active = false).`);
    return {
      message: `Vehicle type has ${activeCarCount} active car listing(s). It was deactivated (soft deleted) instead of permanently removed.`,
      softDeleted: true,
    };
  }

  // Remove linked junction entries before deleting
  await BrandType.destroy({ where: { type_id: vehicleType.id } });

  if (vehicleType.image_public_id) {
    await cloudinaryHelper.deleteImage(vehicleType.image_public_id).catch(() => {});
  }

  await vehicleType.destroy();
  await invalidateVehicleTypeCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] permanently deleted VehicleType [${id}] "${vehicleType.name}"`);
  return { message: 'Vehicle type deleted successfully', softDeleted: false };
};

exports.invalidateVehicleTypeCache = invalidateVehicleTypeCache;
