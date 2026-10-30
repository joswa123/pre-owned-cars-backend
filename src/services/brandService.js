'use strict';

const { Op } = require('sequelize');
const { Brand, VehicleType, BrandType, Car } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const { generateUniqueSlug } = require('../utils/slugify');
const logger = require('../utils/logger');

/**
 * Invalidate all brand-related Redis caches
 */
async function invalidateBrandCaches() {
  try {
    if (!redisClient || !redisClient.isOpen) return;

    const patterns = [
      '__express__/api/v1/types*',
      '__express__/api/types*',
      '__express__/api/v1/catalog*',
      '__express__/api/v1/admin/brands*',
      'brands:*',
      'types:v1:*',
    ];

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (err) {
    logger.warn(`[Redis Brand Cache Invalidation Warning] ${err.message}`);
  }
}

/**
 * Helper to normalize type_ids input (handles array, JSON string, or comma-separated)
 */
function normalizeTypeIds(data = {}) {
  let typeIds = [];

  if (Array.isArray(data.type_ids)) {
    typeIds = data.type_ids.map(id => String(id).trim()).filter(Boolean);
  } else if (typeof data.type_ids === 'string' && data.type_ids.trim()) {
    const raw = data.type_ids.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          typeIds = parsed.map(id => String(id).trim()).filter(Boolean);
        }
      } catch (e) {
        typeIds = raw.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      typeIds = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Also include single type_id if provided and not already included
  if (data.type_id && !typeIds.includes(String(data.type_id).trim())) {
    typeIds.push(String(data.type_id).trim());
  }

  return typeIds;
}

/**
 * Format brand representation with linked types
 */
function formatBrand(brand, isAdmin = false) {
  if (!brand) return null;
  const raw = typeof brand.toJSON === 'function' ? brand.toJSON() : brand;

  const result = {
    id: raw.id,
    name: raw.name,
    slug: raw.slug || null,
    logo: raw.logo || null,
    logo_url: raw.logo || raw.logoUrl || null,
    is_active: Boolean(raw.is_active),
    type_id: raw.type_id || null,
    external_id: raw.external_id || null,
  };

  if (raw.brandTypes || raw.vehicleTypes) {
    const types = raw.brandTypes || raw.vehicleTypes || [];
    result.types = types.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      order: t.order,
      category_id: t.category_id || null,
    }));
  }

  if (isAdmin) {
    result.created_at = raw.created_at;
    result.updated_at = raw.updated_at;
  }

  return result;
}

/**
 * Get brands with active car counts (for catalog browse)
 */
exports.getBrandsWithCarCounts = async () => {
  const cacheKey = 'brands:with_counts';
  try {
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (e) {
    logger.warn(`Redis get error: ${e.message}`);
  }

  const brands = await Brand.findAll({
    where: { is_active: true },
    include: [
      {
        model: VehicleType,
        as: 'brandTypes',
        attributes: ['id', 'name', 'slug'],
        through: { attributes: [] },
        required: false,
      },
    ],
    order: [['name', 'ASC']],
  });

  const counts = await Car.findAll({
    attributes: [
      'brand_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: { status: 'active' },
    group: ['brand_id']
  });

  const countMap = {};
  counts.forEach(c => { countMap[c.brand_id] = parseInt(c.get('count'), 10); });

  const result = brands.map(b => ({
    ...formatBrand(b, false),
    car_count: countMap[b.id] || 0,
  }));

  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
    }
  } catch (e) {
    logger.warn(`Redis setEx error: ${e.message}`);
  }

  return result;
};

/**
 * List all brands (Admin & Catalog)
 */
exports.getAllBrands = async (options = {}) => {
  const { includeInactive = false, isAdmin = false } = options;

  const where = {};
  if (!includeInactive) {
    where.is_active = true;
  }

  const brands = await Brand.findAll({
    where,
    include: [
      {
        model: VehicleType,
        as: 'brandTypes',
        attributes: ['id', 'name', 'slug'],
        through: { attributes: [] },
        required: false,
      },
    ],
    order: [['name', 'ASC']],
  });

  return brands.map(b => formatBrand(b, isAdmin));
};

/**
 * Get brand by UUID or external ID
 */
exports.getBrandById = async (id, options = {}) => {
  const idStr = String(id).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

  const include = [
    {
      model: VehicleType,
      as: 'brandTypes',
      attributes: ['id', 'name', 'slug', 'category_id'],
      through: { attributes: [] },
      required: false,
    },
  ];

  let brand = null;
  if (isUuid) {
    brand = await Brand.findOne({ where: { id: idStr }, include });
  } else if (/^\d+$/.test(idStr)) {
    brand = await Brand.findOne({ where: { external_id: parseInt(idStr, 10) }, include });
  } else {
    brand = await Brand.findOne({ where: { slug: idStr.toLowerCase() }, include });
  }

  if (!brand) {
    throw new AppError(`Brand not found for identifier: ${id}`, 404);
  }

  return formatBrand(brand, Boolean(options.isAdmin));
};

/**
 * Get brands filtered by a specific vehicle type ID
 * Used by GET /api/v1/types/:typeId/brands and GET /api/v1/admin/types/:typeId/brands
 */
exports.getBrandsByType = async (typeId, options = {}) => {
  const typeIdStr = String(typeId || '').trim();
  if (!typeIdStr) {
    throw new AppError('Vehicle type ID is required', 400);
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(typeIdStr);

  // First verify vehicle type exists
  const typeWhere = isUuid ? { id: typeIdStr } : { slug: typeIdStr.toLowerCase() };
  const vehicleType = await VehicleType.findOne({ where: typeWhere });

  if (!vehicleType) {
    throw new AppError(`Vehicle type not found for identifier: ${typeIdStr}`, 404);
  }

  const resolvedTypeId = vehicleType.id;
  const { includeInactive = false, isAdmin = false } = options;

  const cacheKey = `brands:type:${resolvedTypeId}:${includeInactive ? 'admin' : 'pub'}`;

  if (!includeInactive && !isAdmin && redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      logger.warn(`Redis get error: ${e.message}`);
    }
  }

  const brandWhere = {};
  if (!includeInactive) {
    brandWhere.is_active = true;
  }

  // Query brands linked through junction table OR matching fallback type_id
  const brands = await Brand.findAll({
    where: brandWhere,
    include: [
      {
        model: VehicleType,
        as: 'brandTypes',
        attributes: ['id', 'name', 'slug'],
        through: { attributes: [] },
        where: { id: resolvedTypeId },
        required: true,
      },
    ],
    order: [['name', 'ASC']],
  });

  const formatted = brands.map(b => formatBrand(b, isAdmin));

  if (!includeInactive && !isAdmin && redisClient && redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(formatted));
    } catch (e) {
      logger.warn(`Redis setEx error: ${e.message}`);
    }
  }

  return formatted;
};

/**
 * Create a new brand with transaction and type associations
 * POST /api/v1/admin/brands
 */
exports.createBrand = async (data = {}, logoFile = null) => {
  const name = String(data.name || '').trim();
  if (!name) {
    throw new AppError('Brand name is required', 400);
  }

  // Check unique brand name
  const existing = await Brand.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      name.toLowerCase()
    ),
  });
  if (existing) {
    throw new AppError(`Brand name "${name}" already exists`, 409);
  }

  const typeIds = normalizeTypeIds(data);
  const primaryTypeId = typeIds.length > 0 ? typeIds[0] : (data.type_id || null);

  // Generate unique slug
  const slug = data.slug
    ? String(data.slug).trim().toLowerCase()
    : await generateUniqueSlug(Brand, name);

  const logoUrl = logoFile ? logoFile.path : (data.logo || null);
  const isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;

  // Use Managed Transaction for atomic creation
  const transaction = await sequelize.transaction();

  try {
    const brand = await Brand.create({
      name,
      slug,
      logo: logoUrl,
      type_id: primaryTypeId,
      is_active: isActive,
      external_id: data.external_id || null,
    }, { transaction });

    // Sync Many-to-Many types via Sequelize association
    if (typeIds.length > 0) {
      await brand.setBrandTypes(typeIds, { transaction });
    }

    await transaction.commit();

    await invalidateBrandCaches();
    logger.info(`Brand [${brand.id}] "${brand.name}" created with ${typeIds.length} linked type(s)`);

    return await exports.getBrandById(brand.id, { isAdmin: true });
  } catch (error) {
    await transaction.rollback();
    logger.error('Failed to create brand within transaction:', error);
    throw error;
  }
};

/**
 * Update an existing brand with transaction and type associations
 * PUT /api/v1/admin/brands/:id
 */
exports.updateBrand = async (id, data = {}, logoFile = null) => {
  const brand = await Brand.findByPk(id);
  if (!brand) {
    throw new AppError(`Brand not found for ID "${id}"`, 404);
  }

  const updates = {};

  if (data.name !== undefined) {
    const trimmedName = String(data.name).trim();
    if (!trimmedName) throw new AppError('Brand name cannot be empty', 400);

    const duplicate = await Brand.findOne({
      where: {
        id: { [Op.ne]: brand.id },
        name: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          trimmedName.toLowerCase()
        ),
      },
    });
    if (duplicate) {
      throw new AppError(`Brand name "${trimmedName}" is already taken`, 409);
    }
    updates.name = trimmedName;

    if (!data.slug) {
      updates.slug = await generateUniqueSlug(Brand, trimmedName, brand.id);
    }
  }

  if (data.slug !== undefined) {
    updates.slug = String(data.slug).trim().toLowerCase();
  }

  if (logoFile) {
    updates.logo = logoFile.path;
  } else if (data.logo !== undefined) {
    updates.logo = data.logo || null;
  }

  if (data.is_active !== undefined) {
    updates.is_active = Boolean(data.is_active);
  }

  const hasTypeIdsInput = data.type_ids !== undefined || data.type_id !== undefined;
  const typeIds = hasTypeIdsInput ? normalizeTypeIds(data) : null;

  if (typeIds && typeIds.length > 0) {
    updates.type_id = typeIds[0];
  } else if (data.type_id !== undefined) {
    updates.type_id = data.type_id || null;
  }

  // Use Managed Transaction for atomic update
  const transaction = await sequelize.transaction();

  try {
    await brand.update(updates, { transaction });

    if (typeIds !== null) {
      // Sync Many-to-Many types via Sequelize association
      await brand.setBrandTypes(typeIds, { transaction });
    }

    await transaction.commit();

    await invalidateBrandCaches();
    logger.info(`Brand [${brand.id}] "${brand.name}" updated successfully`);

    return await exports.getBrandById(brand.id, { isAdmin: true });
  } catch (error) {
    await transaction.rollback();
    logger.error('Failed to update brand within transaction:', error);
    throw error;
  }
};

/**
 * Delete a brand (Soft delete if active cars exist)
 * DELETE /api/v1/admin/brands/:id
 */
exports.deleteBrand = async (id) => {
  const brand = await Brand.findByPk(id);
  if (!brand) {
    throw new AppError(`Brand not found for ID "${id}"`, 404);
  }

  // Safety check: verify if cars reference this brand
  const activeCarCount = await Car.count({
    where: {
      brand_id: brand.id,
      status: 'active',
    },
  });

  if (activeCarCount > 0) {
    await brand.update({ is_active: false });
    await invalidateBrandCaches();
    logger.warn(`Brand [${id}] "${brand.name}" has ${activeCarCount} active cars. Soft-deleted.`);
    return {
      message: `Brand is currently linked to ${activeCarCount} active car listing(s). It was deactivated (soft deleted) instead of permanently removed.`,
      softDeleted: true,
    };
  }

  const transaction = await sequelize.transaction();
  try {
    await BrandType.destroy({ where: { brand_id: brand.id }, transaction });
    await brand.destroy({ transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await invalidateBrandCaches();
  logger.info(`Brand [${id}] "${brand.name}" permanently deleted`);

  return { message: 'Brand deleted successfully', softDeleted: false };
};

exports.invalidateBrandCaches = invalidateBrandCaches;