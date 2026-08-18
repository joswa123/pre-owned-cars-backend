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
  const cacheKey = 'catalog:brands:v3';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  let brands = await Brand.findAll({
    where: { is_active: true },
    attributes: ['id', 'name', 'logo', 'created_at'],
    order: [['name', 'ASC']],
  });

  // If database has no active brands yet, seed baseline catalog automatically
  if (brands.length === 0) {
    const externalData = await externalCatalogApi.fetchExternalCatalogData();
    if (externalData && externalData.length > 0) {
      await exports.syncCatalogData(externalData);
      brands = await Brand.findAll({
        where: { is_active: true },
        attributes: ['id', 'name', 'logo', 'created_at'],
        order: [['name', 'ASC']],
      });
    }
  }

  const formattedBrands = brands.map((b) => ({
    id: b.id,
    name: b.name,
    logo: b.logo,
    logoUrl: b.logoUrl,
    created_at: b.created_at,
  }));

  await setCache(cacheKey, formattedBrands, 900); // 15 mins
  return formattedBrands;
};

/**
 * Helper to find Brand by UUID or Name/Slug
 */
const findBrandByIdentifier = async (brandId) => {
  if (!brandId) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId);
  let brand = null;

  if (isUuid) {
    brand = await Brand.findOne({
      where: {
        id: brandId,
        is_active: { [Op.ne]: false },
      },
    });
  }

  if (!brand) {
    const searchName = brandId.replace(/-/g, ' ').trim().toLowerCase();
    brand = await Brand.findOne({
      where: {
        is_active: { [Op.ne]: false },
        [Op.and]: [sequelize.where(fn('LOWER', col('name')), searchName)],
      },
    });
  }

  return brand;
};

/**
 * Get models for a specific brand (cached 15 mins)
 */
exports.getModelsByBrand = async (brandId) => {
  const cacheKey = `catalog:brand:${brandId}:models`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  let brand = await findBrandByIdentifier(brandId);

  // If brand is missing from local DB, attempt fallback sync from catalog baseline
  if (!brand) {
    const searchName = brandId.replace(/-/g, ' ').trim();
    const externalData = await externalCatalogApi.fetchExternalCatalogData(searchName);
    if (externalData && externalData.length > 0) {
      await exports.syncCatalogData(externalData);
      brand = await findBrandByIdentifier(brandId);
    }
  }

  if (!brand) throw new AppError('Brand not found.', 404);

  const modelAttributes = [
    'id',
    'brandId',
    'name',
    'body_type',
    'image_url',
    'start_year',
    'end_year',
    [
      sequelize.literal(`(
        SELECT COUNT(*)
        FROM cars AS car
        WHERE car.model_id = Model.id
        AND car.status = 'active'
      )`),
      'car_count',
    ],
  ];

  let models = await Model.findAll({
    where: {
      brandId: brand.id,
      is_active: { [Op.ne]: false },
    },
    attributes: modelAttributes,
    order: [['name', 'ASC']],
  });

  // If brand exists in DB but no models found, perform auto-sync for this brand
  if (models.length === 0) {
    const externalData = await externalCatalogApi.fetchExternalCatalogData(brand.name);
    if (externalData && externalData.length > 0) {
      await exports.syncCatalogData(externalData);
      models = await Model.findAll({
        where: {
          brandId: brand.id,
          is_active: { [Op.ne]: false },
        },
        attributes: modelAttributes,
        order: [['name', 'ASC']],
      });
    }
  }

  const formattedModels = models.map((m) => {
    const json = m.toJSON();
    return {
      ...json,
      car_count: parseInt(json.car_count || 0, 10),
    };
  });

  await setCache(cacheKey, formattedModels, 900);
  return formattedModels;
};

/**
 * Helper to find Model by UUID or Name/Slug
 */
const findModelByIdentifier = async (modelId) => {
  if (!modelId) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modelId);
  let model = null;

  if (isUuid) {
    model = await Model.findOne({
      where: {
        id: modelId,
        is_active: { [Op.ne]: false },
      },
    });
  }

  if (!model) {
    const searchName = modelId.replace(/-/g, ' ').trim().toLowerCase();
    model = await Model.findOne({
      where: {
        is_active: { [Op.ne]: false },
        [Op.and]: [sequelize.where(fn('LOWER', col('name')), searchName)],
      },
    });
  }

  return model;
};

/**
 * Get variants for a specific model (cached 15 mins)
 */
exports.getVariantsByModel = async (modelId) => {
  const cacheKey = `catalog:model:${modelId}:variants`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const model = await findModelByIdentifier(modelId);
  if (!model) throw new AppError('Model not found.', 404);

  let variants = await Variant.findAll({
    where: {
      model_id: model.id,
      is_active: { [Op.ne]: false },
    },
    attributes: ['id', 'model_id', 'name', 'fuel_type', 'transmission', 'engine_cc', 'price'],
    order: [['name', 'ASC']],
  });

  if (variants.length === 0) {
    const externalData = await externalCatalogApi.fetchExternalCatalogData();
    if (externalData && externalData.length > 0) {
      await exports.syncCatalogData(externalData);
      variants = await Variant.findAll({
        where: {
          model_id: model.id,
          is_active: { [Op.ne]: false },
        },
        attributes: ['id', 'model_id', 'name', 'fuel_type', 'transmission', 'engine_cc', 'price'],
        order: [['name', 'ASC']],
      });
    }
  }

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
        attributes: ['id', 'name', 'body_type', 'image_url'],
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
    model_image: v.model ? v.model.image_url : null,
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
    if (!bData || !bData.name) continue;
    const brandLogo = bData.logo || bData.logo_url || null;

    let brand = await Brand.findOne({
      where: sequelize.where(fn('LOWER', col('name')), bData.name.trim().toLowerCase()),
    });

    if (!brand) {
      brand = await Brand.create({
        name: bData.name.trim(),
        logo: brandLogo,
        is_active: true,
      });
      createdCount++;
    } else if (brandLogo && brand.logo !== brandLogo) {
      await brand.update({ logo: brandLogo });
      updatedCount++;
    }

    const modelsList = bData.models || [];
    for (const mData of modelsList) {
      if (!mData || !mData.name) continue;

      let model = await Model.findOne({
        where: {
          brandId: brand.id,
          [Op.and]: [sequelize.where(fn('LOWER', col('name')), mData.name.trim().toLowerCase())],
        },
      });

      if (!model) {
        model = await Model.create({
          brandId: brand.id,
          name: mData.name.trim(),
          body_type: mData.body_type || null,
          start_year: mData.start_year || null,
          is_active: true,
        });
        createdCount++;
      } else if (mData.body_type && model.body_type !== mData.body_type) {
        await model.update({ body_type: mData.body_type });
        updatedCount++;
      }

      const variantsList = mData.variants || [];
      for (const vData of variantsList) {
        if (!vData || !vData.name) continue;

        let variant = await Variant.findOne({
          where: {
            model_id: model.id,
            [Op.and]: [sequelize.where(fn('LOWER', col('name')), vData.name.trim().toLowerCase())],
          },
        });

        if (!variant) {
          await Variant.create({
            model_id: model.id,
            name: vData.name.trim(),
            fuel_type: vData.fuel_type || null,
            transmission: vData.transmission || null,
            engine_cc: vData.engine_cc || null,
            price: vData.price || null,
            is_active: true,
          });
          createdCount++;
        } else {
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

  // Clear Redis catalog caches after sync
  try {
    const { clearCache } = require('../middlewares/cacheMiddleware');
    await clearCache('/api/v1/brands');
    await clearCache('/api/v1/catalog');
    if (redisClient && redisClient.isOpen) {
      await redisClient.del('catalog:brands:v3');
    }
  } catch (err) {
    console.warn(`[Redis Cache Del Warning] ${err.message}`);
  }

  return { createdCount, updatedCount };
};
