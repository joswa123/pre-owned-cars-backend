const { Op } = require('sequelize');
const { CarType, Car } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const { generateUniqueSlug } = require('../utils/slugify');
const cloudinaryHelper = require('../utils/cloudinaryHelper');
const logger = require('../utils/logger');

const CACHE_KEY_PUBLIC_LIST = 'car-types:v2:list';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Invalidate all Redis cache keys related to car types / categories
 */
async function invalidateCarTypeCache() {
  try {
    if (!redisClient || !redisClient.isOpen) return;

    const patterns = [
      '__express__/api/v1/car-types*',
      '__express__/api/car-types*',
      'car-types:v2:*',
      'public:car_types*',
      'catalog:brands*',
    ];

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    }
    logger.info('✅ Car types Redis cache invalidated.');
  } catch (err) {
    logger.warn(`[Redis Cache Invalidation Warning] ${err.message}`);
  }
}

/**
 * Format car type representation
 * @param {Object} item - CarType Sequelize instance or plain object
 * @param {boolean} isAdmin - If true, includes internal fields like image_public_id
 * @returns {Object}
 */
function formatCarType(item, isAdmin = false) {
  if (!item) return null;
  const base = {
    id: item.id,
    name: item.name,
    slug: item.slug,
    icon_url: item.icon_url || null,
    order: item.order !== undefined ? item.order : 999,
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
 * Get all categories / car types
 * Deterministic sort order: order ASC, name ASC, id ASC
 * @param {Object} options - { includeInactive: boolean, isAdmin: boolean }
 * @returns {Promise<Array>}
 */
exports.getAllCarTypes = async (options = {}) => {
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

  let carTypes = await CarType.findAll({
    where,
    order: [
      ['order', 'ASC'],
      ['name', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  // Seed baseline reference data if table is completely empty
  if (carTypes.length === 0) {
    try {
      const seedReferenceData = require('../utils/seedReferenceData');
      await seedReferenceData();
      carTypes = await CarType.findAll({
        where,
        order: [
          ['order', 'ASC'],
          ['name', 'ASC'],
          ['id', 'ASC'],
        ],
      });
    } catch (e) {
      logger.warn(`Could not auto-seed car types: ${e.message}`);
    }
  }

  const formatted = carTypes.map((t) => formatCarType(t, isAdmin));

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
 * Find a single car type by identifier (UUID, slug, or legacy numeric ID)
 * @param {string|number} identifier 
 * @param {Object} options - { isAdmin: boolean }
 * @returns {Promise<Object>}
 */
exports.getCarTypeByIdentifier = async (identifier, options = {}) => {
  if (!identifier) {
    throw new AppError('Category identifier is required.', 400, 'INVALID_IDENTIFIER');
  }

  const idStr = String(identifier).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

  let carType = null;

  if (isUuid) {
    carType = await CarType.findByPk(idStr);
  }

  if (!carType) {
    // Check by slug
    carType = await CarType.findOne({ where: { slug: idStr.toLowerCase() } });
  }

  if (!carType) {
    // Case-insensitive name match fallback
    carType = await CarType.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        idStr.toLowerCase()
      ),
    });
  }

  if (!carType) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  return formatCarType(carType, Boolean(options.isAdmin));
};

/**
 * Backward compatibility alias for getCarTypeByIdentifier
 */
exports.getCarTypeById = async (id, options = {}) => {
  return exports.getCarTypeByIdentifier(id, options);
};

/**
 * Create a new category / car type (Admin only)
 * Atomic logical unit: upload validation -> DB insert -> compensate on failure -> invalidate cache
 * @param {Object} data - { name, slug?, icon_url?, order?, is_active? }
 * @param {Object|null} uploadedFile - Multer file object from CloudinaryStorage
 * @param {Object|null} adminUser - Authenticated admin user record
 * @returns {Promise<Object>}
 */
exports.createCarType = async (data = {}, uploadedFile = null, adminUser = null) => {
  const name = String(data.name || '').trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new AppError('Category name cannot be empty.', 400, 'VALIDATION_ERROR');
  }

  // 1. Uniqueness check (case-insensitive)
  const existing = await CarType.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      name.toLowerCase()
    ),
  });
  if (existing) {
    throw new AppError(`A category with the name "${name}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
  }

  // 2. Derive unique slug
  const slug = data.slug ? String(data.slug).trim().toLowerCase() : await generateUniqueSlug(CarType, name);

  // Check slug uniqueness
  const existingSlug = await CarType.findOne({ where: { slug } });
  if (existingSlug) {
    throw new AppError(`A category with the slug "${slug}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
  }

  // 3. Resolve icon_url and image_public_id (Multipart upload takes precedence over JSON icon_url)
  let icon_url = null;
  let image_public_id = null;

  if (uploadedFile) {
    icon_url = uploadedFile.path;
    image_public_id = uploadedFile.filename || cloudinaryHelper.extractPublicIdFromUrl(uploadedFile.path) || null;
  } else if (data.icon_url) {
    icon_url = String(data.icon_url).trim();
    image_public_id = cloudinaryHelper.extractPublicIdFromUrl(icon_url) || null;
  }

  const order = data.order !== undefined && data.order !== null ? parseInt(data.order, 10) : 999;
  const is_active = data.is_active !== undefined ? Boolean(data.is_active) : true;

  let createdCarType = null;

  // 4. Atomic insert with compensation on DB failure
  try {
    createdCarType = await CarType.create({
      name,
      slug,
      icon_url,
      image_public_id,
      order: isNaN(order) ? 999 : order,
      is_active,
    });
  } catch (err) {
    // Compensation: If file was uploaded to Cloudinary but DB write failed, destroy orphan asset
    if (uploadedFile && image_public_id) {
      logger.warn(`Compensating failed category creation by deleting Cloudinary asset: ${image_public_id}`);
      await cloudinaryHelper.deleteCloudinaryMedia(image_public_id, 'image').catch((delErr) => {
        logger.error(`Orphan cleanup error for ${image_public_id}: ${delErr.message}`);
      });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new AppError(`A category with this name or slug already exists.`, 409, 'CATEGORY_NAME_TAKEN');
    }
    throw err;
  }

  // 5. Invalidate cache after successful DB commit
  await invalidateCarTypeCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] created Category [${createdCarType.id}] "${createdCarType.name}"`);
  return formatCarType(createdCarType, true);
};

/**
 * Update an existing category / car type (Admin only)
 * Handles partial updates, image replacement with old asset cleanup, and compensating on failure.
 * @param {string} id - Category UUID
 * @param {Object} data - Update payload
 * @param {Object|null} uploadedFile - Optional newly uploaded file
 * @param {Object|null} adminUser - Authenticated admin user record
 * @returns {Promise<Object>}
 */
exports.updateCarType = async (id, data = {}, uploadedFile = null, adminUser = null) => {
  const carType = await CarType.findByPk(id);
  if (!carType) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  const updates = {};
  const oldPublicId = carType.image_public_id;
  let newUploadedPublicId = null;

  // 1. Name and slug update
  if (data.name !== undefined) {
    const trimmedName = String(data.name).trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      throw new AppError('Category name cannot be empty.', 400, 'VALIDATION_ERROR');
    }

    // Check uniqueness excluding current record
    const duplicate = await CarType.findOne({
      where: {
        [Op.and]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName.toLowerCase()),
          { id: { [Op.ne]: carType.id } },
        ],
      },
    });

    if (duplicate) {
      throw new AppError(`A category with the name "${trimmedName}" already exists.`, 409, 'CATEGORY_NAME_TAKEN');
    }

    updates.name = trimmedName;

    // If slug not explicitly provided, re-derive unique slug if name changed
    if (data.slug === undefined && trimmedName.toLowerCase() !== carType.name.toLowerCase()) {
      updates.slug = await generateUniqueSlug(CarType, trimmedName, carType.id);
    }
  }

  if (data.slug !== undefined) {
    const customSlug = String(data.slug).trim().toLowerCase();
    const slugConflict = await CarType.findOne({
      where: {
        slug: customSlug,
        id: { [Op.ne]: carType.id },
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

  // 3. Image update logic: multipart file wins over json icon_url
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
    await carType.update(updates);
  } catch (err) {
    // If DB update fails and a new file was uploaded, compensate by deleting the new file
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

  // 5. Post-commit side-effect: Delete old Cloudinary asset if replaced
  if (
    updates.image_public_id !== undefined &&
    oldPublicId &&
    oldPublicId !== updates.image_public_id
  ) {
    cloudinaryHelper.deleteCloudinaryMedia(oldPublicId, 'image').catch((delErr) => {
      logger.warn(`Could not delete old Cloudinary asset ${oldPublicId}: ${delErr.message}`);
    });
  }

  // 6. Invalidate cache after commit
  await invalidateCarTypeCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] updated Category [${carType.id}]`);
  return formatCarType(carType, true);
};

/**
 * Delete a category / car type (Admin only)
 * Enforces blast-radius check: Blocks if any active car listings reference this category.
 * @param {string} id - Category UUID
 * @param {Object|null} adminUser - Authenticated admin user record
 * @returns {Promise<boolean>}
 */
exports.deleteCarType = async (id, adminUser = null) => {
  const carType = await CarType.findByPk(id);
  if (!carType) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }

  // 1. Blast Radius Guard: Check references in cars table
  const referencingCarsCount = await Car.count({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('body_type')),
      carType.name.toLowerCase()
    ),
  });

  if (referencingCarsCount > 0) {
    throw new AppError(
      `Cannot delete category "${carType.name}" because it is currently assigned to ${referencingCarsCount} car listing(s). Please reassign those cars before deleting.`,
      409,
      'CATEGORY_IN_USE',
      { referencingCarsCount, categoryName: carType.name }
    );
  }

  const assetToDelete = carType.image_public_id;

  // 2. Delete row from database
  await carType.destroy();

  // 3. Post-commit side-effect: delete Cloudinary asset
  if (assetToDelete) {
    cloudinaryHelper.deleteCloudinaryMedia(assetToDelete, 'image').catch((err) => {
      logger.warn(`Failed to delete Cloudinary asset ${assetToDelete} after DB delete: ${err.message}`);
    });
  }

  // 4. Invalidate cache
  await invalidateCarTypeCache();

  logger.info(`Admin [${adminUser?.id || 'system'}] deleted Category [${carType.id}] "${carType.name}"`);
  return true;
};