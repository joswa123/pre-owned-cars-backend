'use strict';

const { Op } = require('sequelize');
const { Category } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const { generateUniqueSlug } = require('../utils/slugify');
const cloudinaryHelper = require('../utils/cloudinaryHelper');
const logger = require('../utils/logger');

const CACHE_KEY_PUBLIC_LIST = 'categories:v2:list';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Invalidate all Redis cache keys related to categories
 */
async function invalidateCategoryCache() {
  try {
    if (!redisClient || !redisClient.isOpen) return;

    const patterns = [
      '__express__/api/v1/categories*',
      '__express__/api/categories*',
      '__express__/api/v1/categroeries*',
      'categories:v2:*',
      'public:categories*',
    ];

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    }
    logger.info('✅ Categories Redis cache invalidated.');
  } catch (err) {
    logger.warn(`[Redis Cache Invalidation Warning] ${err.message}`);
  }
}

/**
 * Format category representation
 * @param {Object} item - Category Sequelize instance or plain object
 * @param {boolean} isAdmin - If true, includes internal fields like image_public_id
 * @returns {Object}
 */
function formatCategory(item, isAdmin = false) {
  if (!item) return null;
  const base = {
    id: item.id,
    name: item.name,
    slug: item.slug,
    icon_url: item.icon_url || null,
    order: item.order !== undefined && item.order !== null ? item.order : 0,
    is_active: item.is_active !== undefined ? Boolean(item.is_active) : true,
  };

  if (isAdmin) {
    base.image_public_id = item.image_public_id || null;
    base.created_at = item.created_at;
    base.updated_at = item.updated_at;
  }

  return base;
}

/**
 * Get all categories
 * Deterministic sort order: order ASC, name ASC, id ASC
 * @param {Object} options - { includeInactive: boolean, isAdmin: boolean }
 * @returns {Promise<Array>}
 */
exports.getAllCategories = async (options = {}) => {
  const { includeInactive = false, isAdmin = false } = options;

  // Try Redis cache for public listings
  if (!includeInactive && !isAdmin && redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(CACHE_KEY_PUBLIC_LIST);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[Redis Cache Read Warning] ${err.message}`);
    }
  }

  const where = {};
  if (!includeInactive) {
    where.is_active = true;
  }

  const categories = await Category.findAll({
    where,
    order: [
      ['order', 'ASC'],
      ['name', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const formatted = categories.map((cat) => formatCategory(cat, isAdmin));

  // Set cache for public active list
  if (!includeInactive && !isAdmin && redisClient && redisClient.isOpen) {
    try {
      await redisClient.setEx(CACHE_KEY_PUBLIC_LIST, CACHE_TTL_SECONDS, JSON.stringify(formatted));
    } catch (err) {
      logger.warn(`[Redis Cache Write Warning] ${err.message}`);
    }
  }

  return formatted;
};

/**
 * Find a single category by identifier (UUID, slug, or name)
 * @param {string} identifier 
 * @param {Object} options - { isAdmin: boolean }
 * @returns {Promise<Object>}
 */
exports.getCategoryByIdentifier = async (identifier, options = {}) => {
  if (!identifier) {
    throw new AppError('Category identifier is required.', 400, 'INVALID_IDENTIFIER');
  }

  const idStr = String(identifier).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

  let category = null;

  if (isUuid) {
    category = await Category.findByPk(idStr);
  }

  if (!category) {
    category = await Category.findOne({ where: { slug: idStr.toLowerCase() } });
  }

  if (!category) {
    category = await Category.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        idStr.toLowerCase()
      ),
    });
  }

  if (!category) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  return formatCategory(category, Boolean(options.isAdmin));
};

/**
 * Backward compatibility alias
 */
exports.getCategoryById = async (id, options = {}) => {
  return exports.getCategoryByIdentifier(id, options);
};

/**
 * Create a new category (Admin only)
 * @param {Object} data - { name, slug?, icon_url?, order?, is_active? }
 * @param {Object|null} uploadedFile - Multer file object from CloudinaryStorage
 * @param {Object|null} adminUser - Authenticated admin user record
 * @returns {Promise<Object>}
 */
exports.createCategory = async (data = {}, uploadedFile = null, adminUser = null) => {
  const name = String(data.name || '').trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new AppError('Category name cannot be empty.', 400, 'VALIDATION_ERROR');
  }

  // 1. Uniqueness check (case-insensitive)
  const existing = await Category.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      name.toLowerCase()
    ),
  });
  if (existing) {
    throw new AppError(`A category with the name "${name}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
  }

  // 2. Derive unique slug
  const slug = data.slug ? String(data.slug).trim().toLowerCase() : await generateUniqueSlug(Category, name);

  const existingSlug = await Category.findOne({ where: { slug } });
  if (existingSlug) {
    throw new AppError(`A category with the slug "${slug}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
  }

  // 3. Resolve icon_url and image_public_id
  let icon_url = null;
  let image_public_id = null;

  if (uploadedFile) {
    icon_url = uploadedFile.path;
    image_public_id = uploadedFile.filename || cloudinaryHelper.extractPublicIdFromUrl(uploadedFile.path) || null;
  } else if (data.icon_url) {
    icon_url = String(data.icon_url).trim();
    image_public_id = cloudinaryHelper.extractPublicIdFromUrl(icon_url) || null;
  }

  const order = data.order !== undefined && data.order !== null ? parseInt(data.order, 10) : 0;
  const is_active = data.is_active !== undefined ? Boolean(data.is_active) : true;

  let createdCategory = null;

  // 4. Atomic insert with compensation
  try {
    createdCategory = await Category.create({
      name,
      slug,
      icon_url,
      image_public_id,
      order: isNaN(order) ? 0 : order,
      is_active,
    });
  } catch (err) {
    if (uploadedFile && image_public_id) {
      logger.warn(`Compensating failed category creation by deleting Cloudinary asset: ${image_public_id}`);
      await cloudinaryHelper.deleteCloudinaryMedia(image_public_id, 'image').catch((delErr) => {
        logger.error(`Orphan cleanup error for ${image_public_id}: ${delErr.message}`);
      });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('A category with this name or slug already exists.', 409, 'CATEGORY_NAME_TAKEN');
    }
    throw err;
  }

  // 5. Invalidate cache
  await invalidateCategoryCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] created Category [${createdCategory.id}] "${createdCategory.name}"`);
  return formatCategory(createdCategory, true);
};

/**
 * Update an existing category (Admin only)
 * @param {string} id - Category UUID
 * @param {Object} data - Update payload
 * @param {Object|null} uploadedFile - Optional newly uploaded file
 * @param {Object|null} adminUser - Authenticated admin user record
 * @returns {Promise<Object>}
 */
exports.updateCategory = async (id, data = {}, uploadedFile = null, adminUser = null) => {
  const category = await Category.findByPk(id);
  if (!category) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  const updates = {};
  const oldPublicId = category.image_public_id;
  let newUploadedPublicId = null;

  // 1. Name and slug update
  if (data.name !== undefined) {
    const trimmedName = String(data.name).trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      throw new AppError('Category name cannot be empty.', 400, 'VALIDATION_ERROR');
    }

    const duplicate = await Category.findOne({
      where: {
        [Op.and]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName.toLowerCase()),
          { id: { [Op.ne]: category.id } },
        ],
      },
    });

    if (duplicate) {
      throw new AppError(`A category with the name "${trimmedName}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
    }

    updates.name = trimmedName;

    if (data.slug === undefined && trimmedName.toLowerCase() !== category.name.toLowerCase()) {
      updates.slug = await generateUniqueSlug(Category, trimmedName, category.id);
    }
  }

  if (data.slug !== undefined) {
    const customSlug = String(data.slug).trim().toLowerCase();
    const slugConflict = await Category.findOne({
      where: {
        slug: customSlug,
        id: { [Op.ne]: category.id },
      },
    });
    if (slugConflict) {
      throw new AppError(`A category with the slug "${customSlug}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
    }
    updates.slug = customSlug;
  }

  // 2. Order and is_active updates
  if (data.order !== undefined && data.order !== null) {
    const parsedOrder = parseInt(data.order, 10);
    if (!isNaN(parsedOrder)) {
      updates.order = parsedOrder;
    }
  }

  if (data.is_active !== undefined) {
    updates.is_active = Boolean(data.is_active);
  }

  // 3. Image update logic
  if (uploadedFile) {
    updates.icon_url = uploadedFile.path;
    updates.image_public_id = uploadedFile.filename || cloudinaryHelper.extractPublicIdFromUrl(uploadedFile.path) || null;
    newUploadedPublicId = updates.image_public_id;
  } else if (data.icon_url !== undefined) {
    const rawUrl = data.icon_url ? String(data.icon_url).trim() : null;
    updates.icon_url = rawUrl;
    updates.image_public_id = rawUrl ? cloudinaryHelper.extractPublicIdFromUrl(rawUrl) : null;
  }

  // 4. Execute DB update with compensation
  try {
    await category.update(updates);
  } catch (err) {
    if (newUploadedPublicId) {
      logger.warn(`Compensating failed update by deleting newly uploaded asset: ${newUploadedPublicId}`);
      await cloudinaryHelper.deleteCloudinaryMedia(newUploadedPublicId, 'image').catch((delErr) => {
        logger.error(`Orphan cleanup error for ${newUploadedPublicId}: ${delErr.message}`);
      });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('A category with this name or slug already exists.', 409, 'CATEGORY_NAME_TAKEN');
    }
    throw err;
  }

  // 5. Delete old Cloudinary asset if replaced
  if (
    updates.image_public_id !== undefined &&
    oldPublicId &&
    oldPublicId !== updates.image_public_id
  ) {
    cloudinaryHelper.deleteCloudinaryMedia(oldPublicId, 'image').catch((delErr) => {
      logger.warn(`Could not delete old Cloudinary asset ${oldPublicId}: ${delErr.message}`);
    });
  }

  // 6. Invalidate cache
  await invalidateCategoryCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] updated Category [${category.id}]`);
  return formatCategory(category, true);
};

/**
 * Delete a category (Admin only)
 * @param {string} id - Category UUID
 * @param {Object|null} adminUser - Authenticated admin user record
 * @returns {Promise<boolean>}
 */
exports.deleteCategory = async (id, adminUser = null) => {
  const category = await Category.findByPk(id);
  if (!category) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  const assetToDelete = category.image_public_id;

  // Delete row from database
  await category.destroy();

  // Delete Cloudinary asset if exists
  if (assetToDelete) {
    cloudinaryHelper.deleteCloudinaryMedia(assetToDelete, 'image').catch((err) => {
      logger.warn(`Failed to delete Cloudinary asset ${assetToDelete} after DB delete: ${err.message}`);
    });
  }

  // Invalidate cache
  await invalidateCategoryCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] deleted Category [${category.id}] "${category.name}"`);
  return true;
};

exports.invalidateCategoryCache = invalidateCategoryCache;
