const { Brand, Model, Variant } = require('../models');
const { Op, fn, col } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const externalCatalogApi = require('./externalCatalogApi');
const redisClient = require('../config/redis');

// Cache helper using Redis
const getCache = async (key) => {
  try {
    if (redisClient && redisClient.isOpen) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (err) {
    console.warn(`[Redis Cache Read Warning] ${err.message}`);
  }
  return null;
};

const setCache = async (key, data, ttlSeconds = 600) => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
    }
  } catch (err) {
    console.warn(`[Redis Cache Write Warning] ${err.message}`);
  }
};

/**
 * Get all active vehicle brands (cached 15 mins)
 */
exports.getAllBrands = async () => {
  const cacheKey = 'catalog:brands:all';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const brands = await Brand.findAll({
    where: { is_active: true },
    attributes: ['id', 'name', 'logo', 'logoUrl', 'created_at'],
    order: [['name', 'ASC']],
  });

  await setCache(cacheKey, brands, 900); // 15 mins
  return brands;
};

/**
 * Get models for a specific brand (cached 15 mins)
 */
exports.getModelsByBrand = async (brandId) => {
  const cacheKey = `catalog:brand:${brandId}:models`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new AppError('Brand not found.', 404);

  const models = await Model.findAll({
    where: { brandId, is_active: true },
    attributes: ['id', 'brandId', 'name', 'body_type', 'start_year', 'end_year'],
    order: [['name', 'ASC']],
  });

  await setCache(cacheKey, models, 900);
  return models;
};

/**
 * Get variants for a specific model (cached 15 mins)
 */
exports.getVariantsByModel = async (modelId) => {
  const cacheKey = `catalog:model:${modelId}:variants`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const model = await Model.findByPk(modelId);
  if (!model) throw new AppError('Model not found.', 404);

  const variants = await Variant.findAll({
    where: { model_id: modelId, is_active: true },
    attributes: ['id', 'model_id', 'name', 'fuel_type', 'transmission', 'engine_cc', 'price'],
    order: [['name', 'ASC']],
  });

  await setCache(cacheKey, variants, 900);
  return variants;
};

/**
 * Search across Brands, Models, and Variants with pagination
 */
exports.searchCatalog = async (query = '', page = 1, limit = 20) => {
  const trimmed = query.trim();
  if (!trimmed) {
    return { page, limit, total: 0, results: [] };
  }

  const offset = (page - 1) * limit;

  // Search variants with eager-loaded model & brand
  const { count, rows } = await Variant.findAndCountAll({
    where: {
      is_active: true,
      $or: [
        { name: { $like: `%${trimmed}%` } },
        { '$model.name$': { $like: `%${trimmed}%` } },
        { '$model.brand.name$': { $like: `%${trimmed}%` } },
      ],
    },
    include: [
      {
        model: Model,
        as: 'model',
        attributes: ['id', 'name', 'body_type'],
        include: [{ model: Brand, as: 'brand', attributes: ['id', 'name', 'logoUrl'] }],
      },
    ],
    limit,
    offset,
    order: [['name', 'ASC']],
  });

  const formattedResults = rows.map((v) => ({
    variant_id: v.id,
    variant_name: v.name,
    fuel_type: v.fuel_type,
    transmission: v.transmission,
    engine_cc: v.engine_cc,
    model_id: v.model ? v.model.id : null,
    model_name: v.model ? v.model.name : null,
    body_type: v.model ? v.model.body_type : null,
    brand_id: v.model && v.model.brand ? v.model.brand.id : null,
    brand_name: v.model && v.model.brand ? v.model.brand.name : null,
    brand_logo: v.model && v.model.brand ? v.model.brand.logoUrl : null,
  }));

  return {
    total: count,
    results: formattedResults,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * On-Demand Fetch & Cache: Get Model by Brand & Model Name, or fetch from External API
 */
exports.getOrFetchModel = async (brandName, modelName) => {
  let brand = await Brand.findOne({
    where: sequelize.where(fn('LOWER', col('name')), brandName.trim().toLowerCase()),
  });

  let model = null;
  if (brand) {
    model = await Model.findOne({
      where: {
        brandId: brand.id,
        [Op.and]: [sequelize.where(fn('LOWER', col('name')), modelName.trim().toLowerCase())],
      },
      include: [{ model: Variant, as: 'variants' }],
    });
  }

  // If missing from local DB, fetch from external API fallback
  if (!model) {
    console.log(`🔍 Catalog cache miss for '${brandName} ${modelName}'. Fetching from External API...`);
    const externalData = await externalCatalogApi.fetchExternalCatalogData(brandName);
    if (externalData && externalData.length > 0) {
      await exports.syncCatalogData(externalData);

      // Re-query newly synced model
      brand = await Brand.findOne({
        where: sequelize.where(fn('LOWER', col('name')), brandName.trim().toLowerCase()),
      });
      if (brand) {
        model = await Model.findOne({
          where: {
            brandId: brand.id,
            [Op.and]: [sequelize.where(fn('LOWER', col('name')), modelName.trim().toLowerCase())],
          },
          include: [{ model: Variant, as: 'variants' }],
        });
      }
    }
  }

  return model;
};

/**
 * Idempotent Catalog Synchronization / Upsert Logic
 */
exports.syncCatalogData = async (brandsList) => {
  if (!Array.isArray(brandsList)) return { createdCount: 0, updatedCount: 0 };

  let createdCount = 0;
  let updatedCount = 0;

  for (const bData of brandsList) {
    const [brand, brandCreated] = await Brand.findOrCreate({
      where: { name: bData.name },
      defaults: { is_active: true },
    });
    if (brandCreated) createdCount++;

    const modelsList = bData.models || [];
    for (const mData of modelsList) {
      const [model, modelCreated] = await Model.findOrCreate({
        where: { brandId: brand.id, name: mData.name },
        defaults: {
          body_type: mData.body_type || null,
          start_year: mData.start_year || null,
          is_active: true,
        },
      });

      if (modelCreated) {
        createdCount++;
      } else if (mData.body_type && model.body_type !== mData.body_type) {
        await model.update({ body_type: mData.body_type });
        updatedCount++;
      }

      const variantsList = mData.variants || [];
      for (const vData of variantsList) {
        const [variant, variantCreated] = await Variant.findOrCreate({
          where: { model_id: model.id, name: vData.name },
          defaults: {
            fuel_type: vData.fuel_type || null,
            transmission: vData.transmission || null,
            engine_cc: vData.engine_cc || null,
            price: vData.price || null,
            is_active: true,
          },
        });

        if (variantCreated) {
          createdCount++;
        } else {
          // Idempotent update on existing variant details if changed
          const updates = {};
          if (vData.fuel_type && variant.fuel_type !== vData.fuel_type) updates.fuel_type = vData.fuel_type;
          if (vData.transmission && variant.transmission !== vData.transmission) updates.transmission = vData.transmission;
          if (vData.engine_cc && variant.engine_cc !== vData.engine_cc) updates.engine_cc = vData.engine_cc;
          if (vData.price && variant.price !== vData.price) updates.price = vData.price;

          if (Object.keys(updates).length > 0) {
            await variant.update(updates);
            updatedCount++;
          }
        }
      }
    }
  }

  return { createdCount, updatedCount };
};
