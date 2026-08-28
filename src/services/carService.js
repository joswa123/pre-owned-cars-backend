const { Car, CarImage, User, DealerProfile, Wishlist, Lead, View, State, District, City, Brand, Model, Variant, CarStat } = require('../models');
const { Op, Sequelize, fn, col, where } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');

const clearCache = async (key) => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.error('Redis clear cache error:', err);
  }
};

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

/**
 * Universal cache invalidator for car mutations
 */
const invalidateCarCaches = async (carId = null, userId = null) => {
  try {
    // 1. Service-level exact & pattern cache keys
    await clearCache('brands:with_counts');
    await clearCache('board_type_stats');
    if (carId) {
      await clearCache(`car:${carId}`);
    }
    await clearCachePattern('cars:*');
    await clearCachePattern('seller:*');
    await clearCachePattern('catalog:*');
    await clearCachePattern('car:leads:*');
    await clearCachePattern('seller:lead_summary:*');
    await clearCachePattern('seller:leads:*');

    // 2. HTTP middleware cache keys
    const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
    await clearHttpCache('/api/v1/cars');
    await clearHttpCache('/api/v1/catalog');

    // 3. User Dashboard summary cache
    if (userId) {
      const dashboardService = require('./dashboardService');
      await dashboardService.invalidateDashboardCache(userId);
    }
  } catch (err) {
    console.error('Car cache invalidation error:', err);
  }
};
const { mapToDbValues } = require('../validations/carValidation');

const sellerInclude = {
  model: User,
  as: 'seller',
  attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
  include: [
    { model: District, as: 'district', attributes: ['name'] },
    { model: DealerProfile, as: 'dealerProfile', attributes: ['company_name'] },
  ],
};

const CAR_TYPE_ICONS = {
  convertible: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720053/convertible_zuiut0.png',
  suv: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720105/SUV_utci1f.png',
  coupe: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720117/coupe_dzjsl3.png',
  crossover: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720132/crossover_udktne.png',
  hatchback: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720145/hatchback_aye9d4.png',
  mini_van: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png',
  'mini van': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png',
  'van minivan': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png',
  pickup: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720171/pickup_btpxyv.png',
  sports_sedan: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720582/17709cebb171220991dcca357d428727_ghcvxp.webp',
  'sports sedan': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720582/17709cebb171220991dcca357d428727_ghcvxp.webp',
  notchback: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787721301/notchback_ackoxm.webp',
  muv: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722308/muv.webp',
  estate: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722588/estate.webp',
  wagon: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722588/estate.webp',
  sedan: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720191/sedan_pskci0.png',
  sports_car: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787723212/racing-car-side-view-silhouette-svgrepo-com_1_sur8g5.webp',
  'sports car': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787723212/racing-car-side-view-silhouette-svgrepo-com_1_sur8g5.webp',
};

/**
 * Helper to transform car images into absolute URLs and flatten seller district & company_name
 */
const transformCarImages = (car, baseUrl = null) => {
  if (!car) return null;
  const images = car.images || [];
  const primary = images.find((img) => img.is_primary === true);
  const secondary = images.filter((img) => img.is_primary !== true);
  const base = baseUrl || process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';

  const getOptimizedImageUrl = (url) => {
    if (!url) return null;

    let absUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      absUrl = `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Apply delivery transformations for Cloudinary URLs (WebP/AVIF auto-format, quality, size)
    if (absUrl.includes('res.cloudinary.com') && absUrl.includes('/upload/')) {
      if (!absUrl.includes('/upload/f_auto')) {
        absUrl = absUrl.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }
    }

    return absUrl;
  };

  const carJson = typeof car.toJSON === 'function' ? car.toJSON() : { ...car };

  if (carJson.seller) {
    const rawSeller = car.seller;
    const sellerDistrictName = rawSeller?.district?.name || carJson.seller.district?.name || (typeof carJson.seller.district === 'string' ? carJson.seller.district : null);
    const sellerCompanyName = rawSeller?.dealerProfile?.company_name || carJson.seller.dealerProfile?.company_name || carJson.seller.company_name || null;

    carJson.seller = {
      ...carJson.seller,
      district: sellerDistrictName,
      company_name: sellerCompanyName,
    };
    delete carJson.seller.dealerProfile;
  }

  // Attach icon URL directly for body type
  const normalizedBodyType = carJson.body_type ? carJson.body_type.toString().toLowerCase().trim() : '';
  const matchedIcon = CAR_TYPE_ICONS[normalizedBodyType]
    || CAR_TYPE_ICONS[normalizedBodyType.replace(/[\s-]+/g, '_')]
    || null;
  const optimizedIconUrl = getOptimizedImageUrl(matchedIcon);

  carJson.icon_url = optimizedIconUrl;
  carJson.body_type_icon = optimizedIconUrl;
  carJson.carType = {
    name: carJson.body_type || null,
    icon_url: optimizedIconUrl,
  };
  carJson.bodyTypeInfo = {
    name: carJson.body_type || null,
    icon_url: optimizedIconUrl,
  };

  return {
    ...carJson,
    primary_image: primary ? getOptimizedImageUrl(primary.image_url) : null,
    secondary_images: secondary.map((img) => getOptimizedImageUrl(img.image_url)),
    images: images.map((img) => ({
      ...(typeof img.toJSON === 'function' ? img.toJSON() : img),
      image_url: getOptimizedImageUrl(img.image_url),
    })),
  };
};

exports.transformCarImages = transformCarImages;

const getWishlistSet = async (userId) => {
  if (!userId) return new Set();
  const wishlist = await Wishlist.findAll({
    where: { user_id: userId },
    attributes: ['car_id'],
  });
  return new Set(wishlist.map((w) => w.car_id));
};

/**
 * Create a car listing with auto-assigned posted_by_type and b2b_listing logic
 */
exports.createCar = async (userId, carData, files) => {
  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found.', 404);

    const mapped = mapToDbValues(carData);

    let brandId = mapped.brand_id;
    if (brandId) {
      const brandExists = await Brand.findByPk(brandId, { transaction });
      if (!brandExists) brandId = null;
    }
    if (!brandId && mapped.brand) {
      let brandObj = await Brand.findOne({
        where: sequelize.where(fn('LOWER', col('name')), mapped.brand.trim().toLowerCase()),
        transaction,
      });
      if (!brandObj) {
        brandObj = await Brand.create({ name: mapped.brand.trim(), logo: '' }, { transaction });
      }
      brandId = brandObj.id;
    }
    if (!brandId) throw new AppError('Brand ID or brand name is required.', 400);

    let modelId = mapped.model_id;
    if (modelId) {
      const modelExists = await Model.findByPk(modelId, { transaction });
      if (!modelExists) modelId = null;
    }
    if (!modelId && mapped.model) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapped.model);
      if (isUuid) {
        const mObj = await Model.findByPk(mapped.model, { transaction });
        if (mObj) modelId = mObj.id;
      }
      if (!modelId) {
        let modelObj = await Model.findOne({
          where: {
            [Op.and]: [
              sequelize.where(fn('LOWER', col('name')), mapped.model.trim().toLowerCase()),
              { brandId }
            ]
          },
          transaction
        });
        if (!modelObj) {
          modelObj = await Model.create(
            { name: mapped.model.trim(), brandId, body_type: mapped.body_type || 'SUV' },
            { transaction }
          );
        }
        modelId = modelObj.id;
      }
    }
    if (!modelId) throw new AppError('Model ID or model name is required.', 400);

    let variantId = mapped.variant_id;
    if (variantId) {
      const variantExists = await Variant.findByPk(variantId, { transaction });
      if (!variantExists) variantId = null;
    }
    if (!variantId && mapped.variant) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapped.variant);
      if (isUuid) {
        const vObj = await Variant.findByPk(mapped.variant, { transaction });
        if (vObj) variantId = vObj.id;
      }
      if (!variantId) {
        let variantObj = await Variant.findOne({
          where: {
            [Op.and]: [
              sequelize.where(fn('LOWER', col('name')), mapped.variant.trim().toLowerCase()),
              { model_id: modelId }
            ]
          },
          transaction
        });
        if (!variantObj) {
          variantObj = await Variant.create(
            {
              name: mapped.variant.trim(),
              model_id: modelId,
              fuel_type: mapped.fuel_type,
              transmission: mapped.transmission,
              price: mapped.price
            },
            { transaction }
          );
        }
        variantId = variantObj.id;
      }
    }
    if (!variantId) throw new AppError('Variant ID or variant name is required.', 400);

    const posted_by_type = user.role === 'dealer' ? 'dealer' : 'customer';
    const b2b_listing =
      user.role === 'dealer' && (mapped.b2b_listing === true || mapped.b2b_listing === 'true');

    let stateId = mapped.state_id || user.state_id || null;
    let districtId = mapped.district_id || user.district_id || null;
    let cityId = mapped.city_id || user.city_id || null;

    // Auto-resolve missing location hierarchy from district
    if (districtId) {
      const district = await District.findByPk(districtId, { transaction });
      if (district) {
        stateId = stateId || district.state_id;
        if (!cityId) {
          const city = await City.findOne({ where: { district_id: districtId }, transaction });
          if (city) cityId = city.id;
        }
      } else {
        districtId = null;
      }
    }

    if (cityId) {
      const cityExists = await City.findByPk(cityId, { transaction });
      if (!cityExists) cityId = null;
    }

    if (stateId) {
      const stateExists = await State.findByPk(stateId, { transaction });
      if (!stateExists) stateId = null;
    }

    const carFields = {
      user_id: userId,
      brand_id: brandId,
      model_id: modelId,
      variant_id: variantId,
      year: mapped.year,
      price: mapped.price,
      price_negotiable: mapped.price_negotiable || false,
      km_driven: mapped.km_driven,
      fuel_type: mapped.fuel_type,
      transmission: mapped.transmission,
      ownership: mapped.ownership,
      body_type: mapped.body_type || 'SUV',
      board_type: mapped.board_type || 'Own Board',
      insurance_expiry_date: mapped.insurance_expiry_date || null,
      insurance_type: mapped.insurance_type || 'Not Insured',
      b2b_listing,
      posted_by_type,
      status: mapped.status || 'active',
      description: mapped.description || null,
      color: mapped.color || '',
      number_plate: mapped.number_plate || '',
      prior_appointemnts: mapped.prior_appointemnts === true || mapped.prior_appointemnts === 'true',
      state_id: stateId,
      district_id: districtId,
      city_id: cityId,
    };

    const car = await Car.create(carFields, { transaction });

    const getFileUrl = (f) => f.path || f.secure_url || f.url || (f.filename ? `/uploads/cars/${f.filename}` : 'test-image.png');

    const imageRecords = [];
    if (files && files.primary_image && files.primary_image[0]) {
      imageRecords.push({
        car_id: car.id,
        image_url: getFileUrl(files.primary_image[0]),
        is_primary: true,
      });
    } else if (files && files.images && files.images.length > 0) {
      imageRecords.push({
        car_id: car.id,
        image_url: getFileUrl(files.images[0]),
        is_primary: true,
      });
    } else if (carData.primary_image && typeof carData.primary_image === 'string') {
      imageRecords.push({
        car_id: car.id,
        image_url: carData.primary_image,
        is_primary: true,
      });
    } else if (Array.isArray(carData.images) && carData.images.length > 0) {
      imageRecords.push({
        car_id: car.id,
        image_url: typeof carData.images[0] === 'string' ? carData.images[0] : getFileUrl(carData.images[0]),
        is_primary: true,
      });
    }

    const secondaryFiles = files ? files.images || [] : [];
    const startIdx = (files && (!files.primary_image || !files.primary_image[0]) && files.images && files.images.length > 0) ? 1 : 0;
    for (let i = startIdx; i < secondaryFiles.length; i++) {
      imageRecords.push({
        car_id: car.id,
        image_url: getFileUrl(secondaryFiles[i]),
        is_primary: false,
      });
    }

    if ((!files || !files.images || files.images.length === 0) && Array.isArray(carData.images)) {
      const bodyStartIdx = (!carData.primary_image && carData.images.length > 0) ? 1 : 0;
      for (let i = bodyStartIdx; i < carData.images.length; i++) {
        if (typeof carData.images[i] === 'string') {
          imageRecords.push({
            car_id: car.id,
            image_url: carData.images[i],
            is_primary: false,
          });
        }
      }
    }

    if (imageRecords.length > 0) {
      await CarImage.bulkCreate(imageRecords, { transaction });
    }

    await transaction.commit();

    const createdCar = await Car.findByPk(car.id, {
      include: [
        { model: CarImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'city'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
      ],
    });

    await invalidateCarCaches(createdCar.id, userId);

    return transformCarImages(createdCar);
  } catch (error) {
    console.error('❌ CREATE CAR SERVICE ERROR:', error);
    await transaction.rollback();
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new AppError('Foreign key constraint error: Brand, Model, Variant, or Location not found in database.', 400);
    }
    if (error.name === 'SequelizeValidationError') {
      throw new AppError(error.errors?.[0]?.message || 'Database validation error', 400);
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('Duplicate record detected for this car listing.', 400);
    }
    throw error;
  }
};

exports.getCars = async (
  filters = {},
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  userId = null
) => {
  const cacheKey = `cars:list:${Buffer.from(JSON.stringify({ filters, page, limit, sortBy, sortOrder })).toString('base64')}`;

  let cachedData;
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) cachedData = JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis cache error in getCars:', err);
  }

  let count, transformedCars;

  if (cachedData) {
    count = cachedData.count;
    transformedCars = cachedData.transformedCars;
  } else {
    const offset = (page - 1) * limit;
    const where = { status: 'active' };

    if (filters.posted_by_type) where.posted_by_type = filters.posted_by_type;
    if (filters.b2b_listing !== undefined) {
      where.b2b_listing = filters.b2b_listing === 'true' || filters.b2b_listing === true;
    }

    if (filters.board_types && filters.board_types.length) {
      const boards = Array.isArray(filters.board_types) ? filters.board_types : filters.board_types.split(',');
      where.board_type = { [Op.in]: boards };
    } else if (filters.board_type) {
      if (filters.board_type.toUpperCase() === 'B2B') {
        where.b2b_listing = true;
      } else {
        where.board_type = filters.board_type;
      }
    }

    // Price range & exact price
    if (filters.price !== undefined && filters.price !== null && filters.price !== '') {
      where.price = parseFloat(filters.price);
    } else {
      if (filters.min_price) where.price = { [Op.gte]: parseFloat(filters.min_price) };
      if (filters.max_price) {
        where.price = { ...where.price, [Op.lte]: parseFloat(filters.max_price) };
      }
    }

    // Brands
    if (filters.brands && filters.brands.length) {
      const brandIds = Array.isArray(filters.brands) ? filters.brands : filters.brands.split(',');
      where.brand_id = { [Op.in]: brandIds };
    } else {
      // Fallback for single brand string (backward compatibility)
      if (filters.brand_id) where.brand_id = filters.brand_id;
      if (filters.brand) {
        const brand = await Brand.findOne({ where: { name: filters.brand } });
        if (brand) where.brand_id = brand.id;
      }
    }

    // Models filter (supports model_id, model_ids, models, model string or array)
    if (filters.model_id) {
      where.model_id = filters.model_id;
    } else if (filters.model_ids && filters.model_ids.length) {
      const ids = Array.isArray(filters.model_ids) ? filters.model_ids : filters.model_ids.split(',');
      where.model_id = { [Op.in]: ids };
    } else if (filters.models && filters.models.length) {
      const modelItems = Array.isArray(filters.models) ? filters.models : filters.models.split(',');
      const isUuidList = modelItems.every(m => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.trim()));
      if (isUuidList) {
        where.model_id = { [Op.in]: modelItems.map(m => m.trim()) };
      } else {
        const foundModels = await Model.findAll({ where: { name: { [Op.in]: modelItems } }, attributes: ['id'] });
        if (foundModels.length) where.model_id = { [Op.in]: foundModels.map(m => m.id) };
      }
    } else if (filters.model) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.model);
      if (isUuid) {
        where.model_id = filters.model;
      } else {
        const foundModel = await Model.findOne({ where: { name: { [Op.like]: `${filters.model}%` } } });
        if (foundModel) where.model_id = foundModel.id;
      }
    }

    // Variants filter (supports variant_id, variant_ids, variants, variant)
    if (filters.variant_id) {
      where.variant_id = filters.variant_id;
    } else if (filters.variant_ids && filters.variant_ids.length) {
      const ids = Array.isArray(filters.variant_ids) ? filters.variant_ids : filters.variant_ids.split(',');
      where.variant_id = { [Op.in]: ids };
    } else if (filters.variant) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.variant);
      if (isUuid) {
        where.variant_id = filters.variant;
      } else {
        const foundVariant = await Variant.findOne({ where: { name: { [Op.like]: `${filters.variant}%` } } });
        if (foundVariant) where.variant_id = foundVariant.id;
      }
    }

    // Year range & exact year
    if (filters.year !== undefined && filters.year !== null && filters.year !== '') {
      where.year = parseInt(filters.year);
    } else {
      if (filters.min_year) where.year = { [Op.gte]: parseInt(filters.min_year) };
      if (filters.max_year) {
        where.year = { ...where.year, [Op.lte]: parseInt(filters.max_year) };
      }
    }

    // KM range & exact km
    if (filters.km_driven !== undefined && filters.km_driven !== null && filters.km_driven !== '') {
      where.km_driven = parseFloat(filters.km_driven);
    } else {
      if (filters.min_km) where.km_driven = { [Op.gte]: parseFloat(filters.min_km) };
      if (filters.max_km) {
        where.km_driven = { ...where.km_driven, [Op.lte]: parseFloat(filters.max_km) };
      }
    }

    // Fuel types
    if (filters.fuel_types && filters.fuel_types.length) {
      const fuels = Array.isArray(filters.fuel_types) ? filters.fuel_types : filters.fuel_types.split(',');
      where.fuel_type = { [Op.in]: fuels };
    } else if (filters.fuel_type) {
      where.fuel_type = filters.fuel_type;
    }

    // Body types
    if (filters.body_types && filters.body_types.length) {
      const bodies = Array.isArray(filters.body_types) ? filters.body_types : filters.body_types.split(',');
      where.body_type = { [Op.in]: bodies };
    } else if (filters.body_type) {
      where.body_type = filters.body_type;
    }

    // Ownership
    if (filters.ownerships && filters.ownerships.length) {
      const owns = Array.isArray(filters.ownerships) ? filters.ownerships : filters.ownerships.split(',');
      where.ownership = { [Op.in]: owns };
    }

    // Transmissions
    if (filters.transmissions && filters.transmissions.length) {
      const trans = Array.isArray(filters.transmissions) ? filters.transmissions : filters.transmissions.split(',');
      where.transmission = { [Op.in]: trans };
    } else if (filters.transmission) {
      where.transmission = filters.transmission;
    }

    // Colors
    if (filters.colors && filters.colors.length) {
      const colors = Array.isArray(filters.colors) ? filters.colors : filters.colors.split(',');
      where.color = { [Op.in]: colors };
    } else if (filters.color) {
      where.color = filters.color;
    }

    // Posted within days
    if (filters.posted_within_days) {
      const days = parseInt(filters.posted_within_days);
      if (days >= 1 && days <= 90) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        where.created_at = { [Op.gte]: date };
      }
    }

    // Expired cars (exclude by default)
    if (!filters.include_expired) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      where.created_at = { ...where.created_at, [Op.gte]: ninetyDaysAgo };
    }

    // Location
    if (filters.state_id) where.state_id = filters.state_id;
    if (filters.district_id) where.district_id = filters.district_id;
    if (filters.city_id) where.city_id = filters.city_id;

    // Wishlist filters
    if (filters.has_wishlist !== undefined && filters.has_wishlist !== null && filters.has_wishlist !== '') {
      const hasWishlist = filters.has_wishlist === 'true' || filters.has_wishlist === true;
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push(
        sequelize.literal(`(
          SELECT COUNT(*) FROM wishlists WHERE wishlists.car_id = Car.id
        ) ${hasWishlist ? '> 0' : '= 0'}`)
      );
    }

    if (filters.min_wishlist !== undefined && filters.min_wishlist !== null && filters.min_wishlist !== '') {
      const minCount = parseInt(filters.min_wishlist, 10);
      if (!isNaN(minCount)) {
        if (!where[Op.and]) where[Op.and] = [];
        where[Op.and].push(
          sequelize.literal(`(
            SELECT COUNT(*) FROM wishlists WHERE wishlists.car_id = Car.id
          ) >= ${minCount}`)
        );
      }
    }

    const queryResult = await Car.findAndCountAll({
      attributes: [
        'id', 'model_id', 'variant_id', 'year', 'price', 'price_negotiable', 'km_driven',
        'fuel_type', 'transmission', 'ownership', 'body_type', 'board_type',
        'insurance_expiry_date', 'insurance_type', 'b2b_listing', 'posted_by_type',
        'status', 'description', 'color', 'number_plate', 'prior_appointemnts',
        'state_id', 'district_id', 'city_id', 'brand_id', 'user_id',
        'created_at', 'updated_at', 'deleted_at',
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM wishlists WHERE wishlists.car_id = Car.id
          )`),
          'wishlist_count'
        ]
      ],
      distinct: true,
      col: 'id',
      where,
      include: [
        { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        sellerInclude,
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: Lead, as: 'leads', attributes: ['id'] },
      ],
      limit,
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
    });

    count = queryResult.count;

    // Limit images to 6 per car
    queryResult.rows.forEach(car => {
      if (car.images && car.images.length > 6) {
        const primary = car.images.find(img => img.is_primary) || car.images[0];
        const secondary = car.images.filter(img => img.id !== primary.id).slice(0, 5);
        car.images = [primary, ...secondary];
      }
    });

    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
    transformedCars = queryResult.rows.map((car) => {
      const transformed = transformCarImages(car, baseUrl);
      const is_expired = transformed.created_at && (Date.now() - new Date(transformed.created_at).getTime()) > 90 * 24 * 60 * 60 * 1000;
      const wishlistCount = parseInt(car.get('wishlist_count') || car.wishlist_count || transformed.wishlist_count || 0, 10) || 0;
      return {
        ...transformed,
        wishlist_count: wishlistCount,
        enquiry_count: (userId && userId === car.user_id) ? (car.leads?.length || 0) : null,
        is_expired,
      };
    });

    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(cacheKey, 60, JSON.stringify({ count, transformedCars }));
      }
    } catch (err) {
      console.error('Redis set cache error in getCars:', err);
    }
  }

  const wishlistSet = await getWishlistSet(userId);
  const carsWithWishlist = transformedCars.map((car) => ({
    ...car,
    isWishlist: wishlistSet.has(car.id),
  }));

  return {
    total: count,
    cars: carsWithWishlist,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * Get single car details by ID
 */
exports.getCarById = async (carId, userId = null) => {
  const cacheKey = `car:${carId}`;

  let transformedCar;
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        transformedCar = JSON.parse(cached);
      }
    }
  } catch (err) {
    console.error('Redis cache error in getCarById:', err);
  }

  if (!transformedCar) {
    const car = await Car.findByPk(carId, {
      attributes: {
        include: [
          'created_at',
          'deleted_at',
          [
            sequelize.literal(`(
              SELECT COUNT(*) FROM wishlists WHERE wishlists.car_id = Car.id
            )`),
            'wishlist_count'
          ]
        ]
      },
      include: [
        { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        sellerInclude,
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: Lead, as: 'leads', attributes: ['id'], required: false },
        { model: CarStat, as: 'stats', required: false },
      ],
    });
    if (!car) throw new AppError('Car not found.', 404);

    // Limit images to 6 (1 primary + 5 secondary)
    if (car.images && car.images.length > 6) {
      const primary = car.images.find(img => img.is_primary) || car.images[0];
      const secondary = car.images.filter(img => img.id !== primary.id).slice(0, 5);
      car.images = [primary, ...secondary];
    }

    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
    const baseTransformed = transformCarImages(car, baseUrl);

    // Compute live metrics
    const stats = car.stats || {};
    const [dbViewsCount, dbWishlistCount] = await Promise.all([
      View.count({ where: { car_id: car.id } }),
      Wishlist.count({ where: { car_id: car.id } }),
    ]);

    const viewsCount = Math.max(stats.views_count || 0, dbViewsCount);
    const subqueryWishlistCount = parseInt(car.get('wishlist_count') || 0, 10);
    const wishlistCount = Math.max(stats.wishlist_count || 0, dbWishlistCount, subqueryWishlistCount);
    const enquiriesCount = stats.enquiries_count || (car.leads?.length || 0);

    const metrics = {
      views: viewsCount,
      views_count: viewsCount,
      enquiries: enquiriesCount,
      enquiry_count: enquiriesCount,
      calls: stats.calls_count || 0,
      calls_count: stats.calls_count || 0,
      whatsapp: stats.whatsapp_count || 0,
      whatsapp_count: stats.whatsapp_count || 0,
      messages: stats.messages_count || 0,
      messages_count: stats.messages_count || 0,
      wishlist_count: wishlistCount,
      wishlists: wishlistCount,
    };

    transformedCar = {
      ...baseTransformed,
      views: viewsCount,
      views_count: viewsCount,
      wishlist_count: wishlistCount,
      enquiry_count: enquiriesCount,
      metrics,
    };

    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(cacheKey, 60, JSON.stringify(transformedCar));
      }
    } catch (err) {
      console.error('Redis set cache error in getCarById:', err);
    }
  }

  const wishlistSet = await getWishlistSet(userId);
  return {
    ...transformedCar,
    isWishlist: wishlistSet.has(carId),
  };
};

/**
 * Get featured cars
 */
exports.getFeaturedCars = async (limit = 10, userId = null) => {
  const cars = await Car.findAll({
    where: { status: 'active' },
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
    limit,
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = cars.map((car) => transformCarImages(car, baseUrl));

  const wishlistSet = await getWishlistSet(userId);
  return transformedCars.map((car) => ({
    ...car,
    isWishlist: wishlistSet.has(car.id),
  }));
};

/**
 * Get listings belonging to logged-in user with high-scale metrics aggregation
 */
exports.getUserCars = async (userId, options = {}) => {
  const status = typeof options === 'string' ? options : options.status;
  const page = typeof options === 'object' && options.page ? parseInt(options.page) : 1;
  const limit = typeof options === 'object' && options.limit ? parseInt(options.limit) : 20;
  const cursor = typeof options === 'object' ? options.cursor : null;

  const whereClause = { user_id: userId };
  let queryModel = Car;

  if (status && status !== 'all') {
    whereClause.status = status;
    if (status === 'deleted') {
      queryModel = Car.unscoped();
    }
  }

  // Keyset Cursor Pagination (High-Speed O(1) Seek for infinite scroll)
  if (cursor) {
    whereClause.created_at = { [Op.lt]: new Date(cursor) };
  }

  const queryOptions = {
    where: whereClause,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
      { model: Lead, as: 'leads', attributes: ['id'] },
      { model: CarStat, as: 'stats', required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
  };

  // If no cursor provided and standard page > 1 requested, use offset fallback
  if (!cursor && page > 1) {
    queryOptions.offset = (page - 1) * parseInt(limit);
  }

  const cars = await queryModel.findAll(queryOptions);

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = cars.map((car) => {
    const transformed = transformCarImages(car, baseUrl);
    const is_expired = transformed.created_at && (Date.now() - new Date(transformed.created_at).getTime()) > 90 * 24 * 60 * 60 * 1000;

    const stats = car.stats || {};
    const enquiries = stats.enquiries_count || (car.leads?.length || 0);

    return {
      ...transformed,
      enquiry_count: enquiries,
      is_expired,
      metrics: {
        views: stats.views_count || 0,
        enquiries,
        calls: stats.calls_count || 0,
        whatsapp: stats.whatsapp_count || 0,
        messages: stats.messages_count || 0,
        wishlist_count: stats.wishlist_count || 0,
      },
    };
  });

  const lastCar = cars.length > 0 ? cars[cars.length - 1] : null;
  const next_cursor = lastCar && lastCar.created_at ? lastCar.created_at.toISOString() : null;

  return {
    cars: transformedCars,
    pagination: {
      limit: parseInt(limit),
      page: cursor ? null : page,
      next_cursor,
      has_more: cars.length === parseInt(limit),
    },
  };
};

/**
 * Update car listing
 */
exports.updateCar = async (carId, userId, updateData, files) => {
  const transaction = await sequelize.transaction();
  try {
    const car = await Car.findOne({ where: { id: carId, user_id: userId }, transaction });
    if (!car) throw new AppError('Car not found or unauthorized.', 404);

    const mapped = mapToDbValues(updateData || {});
    let brandId = mapped.brand_id;
    if (!brandId && mapped.brand) {
      let brandObj = await Brand.findOne({ where: { name: mapped.brand }, transaction });
      if (!brandObj) {
        brandObj = await Brand.create({ name: mapped.brand, logo: '' }, { transaction });
      }
      brandId = brandObj.id;
    }

    let modelId = mapped.model_id;
    if (!modelId && mapped.model) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapped.model);
      if (isUuid) {
        modelId = mapped.model;
      } else {
        let modelObj = await Model.findOne({ where: { name: mapped.model }, transaction });
        if (!modelObj && brandId) {
          modelObj = await Model.create({ name: mapped.model, brandId, body_type: mapped.body_type || 'SUV' }, { transaction });
        }
        if (modelObj) modelId = modelObj.id;
      }
    }

    let variantId = mapped.variant_id;
    if (!variantId && mapped.variant) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapped.variant);
      if (isUuid) {
        variantId = mapped.variant;
      } else {
        let variantObj = await Variant.findOne({ where: { name: mapped.variant }, transaction });
        if (!variantObj && modelId) {
          variantObj = await Variant.create({ name: mapped.variant, model_id: modelId }, { transaction });
        }
        if (variantObj) variantId = variantObj.id;
      }
    }

    const filteredData = {};
    if (brandId) filteredData.brand_id = brandId;
    if (modelId) filteredData.model_id = modelId;
    if (variantId) filteredData.variant_id = variantId;
    if (mapped.year !== undefined) filteredData.year = mapped.year;
    if (mapped.price !== undefined) filteredData.price = mapped.price;
    if (mapped.price_negotiable !== undefined) filteredData.price_negotiable = mapped.price_negotiable;
    if (mapped.km_driven !== undefined) filteredData.km_driven = mapped.km_driven;
    if (mapped.fuel_type !== undefined) filteredData.fuel_type = mapped.fuel_type;
    if (mapped.transmission !== undefined) filteredData.transmission = mapped.transmission;
    if (mapped.ownership !== undefined) filteredData.ownership = mapped.ownership;
    if (mapped.body_type !== undefined) filteredData.body_type = mapped.body_type;
    if (mapped.board_type !== undefined) filteredData.board_type = mapped.board_type;
    if (mapped.insurance_expiry_date !== undefined) filteredData.insurance_expiry_date = mapped.insurance_expiry_date;
    if (mapped.insurance_type !== undefined) filteredData.insurance_type = mapped.insurance_type;
    if (mapped.b2b_listing !== undefined) filteredData.b2b_listing = mapped.b2b_listing;
    if (mapped.status !== undefined) filteredData.status = mapped.status;
    if (mapped.engine_cc !== undefined) filteredData.engine_cc = mapped.engine_cc;
    if (mapped.description !== undefined) filteredData.description = mapped.description;

    if (updateData.replace_images === true || updateData.replace_images === 'true') {
      await CarImage.destroy({ where: { car_id: car.id }, transaction });
    } else if (updateData.images_to_keep !== undefined) {
      let imagesToKeep = updateData.images_to_keep;
      if (typeof imagesToKeep === 'string') {
        try {
          imagesToKeep = JSON.parse(imagesToKeep);
        } catch (e) {
          // If not valid JSON array, treat as single string (e.g. one ID) or empty
          imagesToKeep = imagesToKeep ? [imagesToKeep] : [];
        }
      }
      if (Array.isArray(imagesToKeep)) {
        await CarImage.destroy({
          where: {
            car_id: car.id,
            id: { [Op.notIn]: imagesToKeep }
          },
          transaction
        });
      }
    }

    await car.update(filteredData, { transaction });

    if (files) {
      const getFileUrl = (f) => f.path || f.secure_url || f.url || (f.filename ? `/uploads/cars/${f.filename}` : 'test-image.png');

      const imageRecords = [];

      if (files.primary_image && files.primary_image[0]) {
        // Only replace primary image
        await CarImage.destroy({ where: { car_id: car.id, is_primary: true }, transaction });
        imageRecords.push({
          car_id: car.id,
          image_url: getFileUrl(files.primary_image[0]),
          is_primary: true,
        });
      }

      const secondaryFiles = files.images || [];
      secondaryFiles.forEach((file) => {
        imageRecords.push({
          car_id: car.id,
          image_url: getFileUrl(file),
          is_primary: false,
        });
      });

      if (imageRecords.length > 0) {
        await CarImage.bulkCreate(imageRecords, { transaction });
      }
    }

    await transaction.commit();

    const updatedCar = await Car.findByPk(car.id, {
      include: [
        { model: CarImage, as: 'images' },
        sellerInclude,
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
      ],
    });

    await invalidateCarCaches(updatedCar.id, userId);

    return updatedCar;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Delete a specific car image
 */
exports.deleteCarImage = async (userId, carId, imageId, userRole) => {
  const transaction = await sequelize.transaction();
  try {
    const carWhere = { id: carId };
    if (userRole !== 'admin') {
      carWhere.user_id = userId;
    }
    const car = await Car.findOne({ where: carWhere, transaction });
    if (!car) throw new AppError('Car not found or unauthorized.', 404);

    const image = await CarImage.findOne({ where: { id: imageId, car_id: car.id }, transaction });
    if (!image) throw new AppError('Image not found.', 404);

    const wasPrimary = image.is_primary;
    await image.destroy({ transaction });

    if (wasPrimary) {
      const nextImage = await CarImage.findOne({ where: { car_id: car.id }, transaction });
      if (nextImage) {
        await nextImage.update({ is_primary: true }, { transaction });
      }
    }

    await transaction.commit();
    await invalidateCarCaches(carId, userId);
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Mark car as sold
 */
exports.markCarAsSold = async (carId, userId, userRole = null) => {
  const car = await Car.unscoped().findByPk(carId);
  if (!car) throw new AppError('Car not found.', 404);

  // Authorization: Owner or Admin
  let isAdmin = userRole === 'admin';
  if (!isAdmin && userRole === null) {
    const user = await User.findByPk(userId);
    isAdmin = user?.role === 'admin';
  }

  if (car.user_id !== userId && !isAdmin) {
    throw new AppError('You are not authorized to mark this car as sold', 403);
  }

  if (car.status === 'sold') {
    throw new AppError('Car is already sold', 400);
  }

  if (car.status === 'deleted') {
    throw new AppError('Cannot sell a deleted car', 400);
  }

  await car.update({ status: 'sold' });

  await invalidateCarCaches(car.id, car.user_id);

  const updatedCar = await Car.findByPk(car.id, {
    include: [
      { model: CarImage, as: 'images' },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  return transformCarImages(updatedCar, baseUrl);
};

/**
 * Delete car listing (Soft Delete)
 */
exports.deleteCar = async (carId, userId) => {
  const car = await Car.findOne({ where: { id: carId, user_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  // Soft delete: update status and set deleted_at
  await car.update({ status: 'deleted', deleted_at: new Date() });

  await invalidateCarCaches(carId, userId);

  return { success: true };
};

/**
 * Admin: Get all cars
 */
exports.getAdminCars = async (filters = {}, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC') => {
  const offset = (page - 1) * limit;
  const where = {};
  let queryModel = Car;

  if (filters.posted_by_type) where.posted_by_type = filters.posted_by_type;
  if (filters.b2b_listing !== undefined) {
    where.b2b_listing = filters.b2b_listing === 'true' || filters.b2b_listing === true;
  }
  if (filters.status !== undefined) {
    where.status = filters.status;
    if (filters.status === 'deleted') {
      queryModel = Car.unscoped();
    }
  }
  if (filters.state_id) where.state_id = filters.state_id;
  if (filters.district_id) where.district_id = filters.district_id;
  if (filters.city_id) where.city_id = filters.city_id;

  const { count, rows } = await queryModel.findAndCountAll({
    distinct: true,
    col: 'id',
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = rows.map((car) => transformCarImages(car, baseUrl));

  return {
    total: count,
    cars: transformedCars,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * Admin: Get dashboard stats
 */
exports.getAdminStats = async () => {
  const [totalListings, customerListings, dealerListings, b2bListings] = await Promise.all([
    Car.count(),
    Car.count({ where: { posted_by_type: 'customer' } }),
    Car.count({ where: { posted_by_type: 'dealer' } }),
    Car.count({ where: { b2b_listing: true } }),
  ]);

  return {
    totalListings,
    customerListings,
    dealerListings,
    b2bListings,
  };
};

/**
 * Admin: Update car availability status
 */
exports.updateCarStatus = async (carId, status, adminId) => {
  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found.', 404);

  await car.update({ status });
  await invalidateCarCaches(carId, car.user_id);

  return car;
};

/**
 * Admin: Toggle featured status
 */
exports.toggleFeatured = async (carId, is_featured) => {
  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found.', 404);
  const status = is_featured ? 'active' : 'deleted';
  await car.update({ status });
  await invalidateCarCaches(carId, car.user_id);

  return car;
};

/**
 * Get active car counts grouped by board type
 */
exports.getBoardTypeStats = async () => {
  const cacheKey = 'board_type_stats';
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis get cache error in getBoardTypeStats:', err);
  }

  const [results, b2bCount] = await Promise.all([
    Car.findAll({
      attributes: [
        'board_type',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: { status: 'active' },
      group: ['board_type']
    }),
    Car.count({
      where: {
        status: 'active',
        b2b_listing: true,
      }
    })
  ]);

  const stats = { 'OWN BOARD': 0, 'T-BOARD': 0, 'COMMERCIAL': 0, 'B2B': parseInt(b2bCount, 10) || 0 };
  results.forEach(r => {
    if (r.board_type) {
      const key = r.board_type.toString().trim().toUpperCase();
      if (stats[key] !== undefined) {
        stats[key] = parseInt(r.get('count'), 10) || 0;
      }
    }
  });

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(stats));
    }
  } catch (err) {
    console.error('Redis set cache error in getBoardTypeStats:', err);
  }
  return stats;
};

/**
 * Record a car view (Unique per user tracking & live metrics)
 */
exports.recordView = async (carId, userId = null, ipAddress = null) => {
  if (!userId) return; // guests not tracked

  // Fetch the car to check owner
  const car = await Car.findByPk(carId, { attributes: ['user_id'] });
  if (!car) return;
  if (car.user_id === userId) return; // ✅ Don't count seller's own views

  const existing = await View.findOne({ where: { car_id: carId, user_id: userId } });
  if (!existing) {
    await View.create({ car_id: carId, user_id: userId });
  }

  if (userId) {
    const existing = await View.findOne({
      where: { car_id: carId, user_id: userId },
    });
    if (!existing) {
      await View.create({ car_id: carId, user_id: userId, timestamp: new Date() });
      const analyticsService = require('./analyticsService');
      await analyticsService.recordInteraction({ carId, userId, type: 'view', ipAddress });
    } else {
      // Update the timestamp to reflect the latest view time without inflating records
      await existing.update({ timestamp: new Date() });
    }
  } else {
    // Guest view: record aggregated metrics with rate limiting
    const analyticsService = require('./analyticsService');
    await analyticsService.recordInteraction({ carId, userId: null, type: 'view', ipAddress });
  }

  // Invalidate single car cache & HTTP middleware cache
  await clearCache(`car:${carId}`);
  const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
  await clearHttpCache(`/api/v1/cars/${carId}`);
};

/**
 * Get Seller Listings (Other cars from same seller)
 */
exports.getSellerListings = async (sellerId, excludeCarId = null, page = 1, limit = 10) => {
  const cacheKey = `seller:${sellerId}:${page}:${limit}:${excludeCarId || 'none'}`;
  let cachedData;
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) cachedData = JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis cache error in getSellerListings:', err);
  }

  if (cachedData) {
    return cachedData;
  }

  const offset = (page - 1) * limit;
  const whereClause = {
    user_id: sellerId,
    status: 'active',
  };
  if (excludeCarId) {
    whereClause.id = { [Op.ne]: excludeCarId };
  }

  const result = await Car.findAndCountAll({
    distinct: true,
    col: 'id',
    where: whereClause,
    attributes: [
      'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'price_negotiable', 'km_driven',
      'fuel_type', 'transmission', 'ownership', 'status', 'created_at', 'brand_id', 'body_type',
      'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
    ],
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
        model: CarImage,
        as: 'images',
        attributes: ['id', 'image_url', 'is_primary'],
        where: { is_primary: true },
        required: false,
      },
      {
        model: State,
        as: 'state',
        attributes: ['id', 'name'],
      },
      {
        model: District,
        as: 'district',
        attributes: ['id', 'name'],
      },
      {
        model: City,
        as: 'city',
        attributes: ['id', 'name'],
      }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = result.rows.map((car) => transformCarImages(car, baseUrl));

  const responseData = {
    listings: transformedCars,
    pagination: {
      page,
      limit,
      total: result.count,
      totalPages: Math.ceil(result.count / limit),
    },
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));
    }
  } catch (err) {
    console.error('Redis cache set error:', err);
  }

  return responseData;
};

/**
 * Get Similar and Recommended Cars
 */
exports.getSimilarRecommended = async (carId, userId, limit = 4, page = 1) => {
  const cacheKeySimilar = `similar:${carId}:${page}:${limit}`;
  const cacheKeyRecommended = `recommended:${userId || 'trending'}`;

  let similarCarsData = null;
  let recommendedCarsData = null;

  try {
    if (redisClient.isOpen) {
      const cachedSimilar = await redisClient.get(cacheKeySimilar);
      if (cachedSimilar) similarCarsData = JSON.parse(cachedSimilar);

      const cachedRec = await redisClient.get(cacheKeyRecommended);
      if (cachedRec) recommendedCarsData = JSON.parse(cachedRec);
    }
  } catch (err) {
    console.error('Redis cache error in getSimilarRecommended:', err);
  }

  const targetCar = await Car.findByPk(carId);
  if (!targetCar) {
    throw new AppError('Car not found.', 404);
  }

  // 1. Fetch Similar Cars (if not cached)
  if (!similarCarsData) {
    const offset = (page - 1) * limit;
    // Step 1: Gather candidates (Brand OR Model OR BodyType)
    const candidates = await Car.findAll({
      where: {
        status: 'active',
        id: { [Op.ne]: carId },
        [Op.or]: [
          { brand_id: targetCar.brand_id },
          targetCar.model_id ? { model_id: targetCar.model_id } : null,
          targetCar.body_type ? { body_type: targetCar.body_type } : null
        ].filter(Boolean)
      },
      attributes: [
        'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'price_negotiable',
        'km_driven', 'fuel_type', 'transmission', 'ownership', 'status',
        'created_at', 'brand_id', 'body_type',
        'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
      ],
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'], where: { is_primary: true }, required: false },
        { model: State, as: 'state', attributes: ['name'] },
        { model: District, as: 'district', attributes: ['name'] },
        { model: City, as: 'city', attributes: ['name'] }
      ]
    });

    let scoredCandidates = candidates.map(car => {
      let score = 0;
      if (car.brand_id === targetCar.brand_id) score += 50;
      if (car.model_id && targetCar.model_id && car.model_id === targetCar.model_id) score += 30;
      if (car.body_type && targetCar.body_type && car.body_type.toLowerCase() === targetCar.body_type.toLowerCase()) score += 15;
      if (car.fuel_type && targetCar.fuel_type && car.fuel_type.toLowerCase() === targetCar.fuel_type.toLowerCase()) score += 5;
      if (car.transmission && targetCar.transmission && car.transmission.toLowerCase() === targetCar.transmission.toLowerCase()) score += 5;

      if (targetCar.price && car.price) {
        const diff = Math.abs(parseFloat(car.price) - parseFloat(targetCar.price)) / parseFloat(targetCar.price);
        if (diff <= 0.20) score += 20;
      }

      if (targetCar.year && car.year) {
        if (Math.abs(car.year - targetCar.year) <= 3) score += 10;
      }
      return { car, score };
    });

    // Sort by score DESC, created_at DESC
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.car.created_at) - new Date(a.car.created_at);
    });

    // Fallback logic
    if (scoredCandidates.length === 0) {
      // Third attempt: Fallback to same brand only, latest 4
      const fallbackCars = await Car.findAll({
        where: {
          status: 'active',
          id: { [Op.ne]: carId },
          brand_id: targetCar.brand_id
        },
        order: [['created_at', 'DESC']],
        limit: 4,
        attributes: [
          'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'price_negotiable',
          'km_driven', 'fuel_type', 'transmission', 'ownership', 'status',
          'created_at', 'brand_id', 'body_type',
          'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
        ],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'], where: { is_primary: true }, required: false },
          { model: State, as: 'state', attributes: ['name'] },
          { model: District, as: 'district', attributes: ['name'] },
          { model: City, as: 'city', attributes: ['name'] }
        ]
      });
      scoredCandidates = fallbackCars.map(car => ({ car, score: 0 }));
    }

    const total = scoredCandidates.length;
    const paginatedCars = scoredCandidates.slice(offset, offset + limit).map(sc => sc.car);

    similarCarsData = {
      data: paginatedCars,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(cacheKeySimilar, 300, JSON.stringify(similarCarsData));
      }
    } catch (err) { }
  }

  // 2. Fetch Recommended Cars
  if (!recommendedCarsData) {
    let recommendedCarIds = [];

    // Method 1: Collaborative Filtering
    try {
      const coViewQuery = `
        WITH target_viewers AS (
            SELECT DISTINCT user_id FROM views WHERE car_id = :carId AND user_id IS NOT NULL
        )
        SELECT car_id, COUNT(*) as co_view_count
        FROM views
        WHERE user_id IN (SELECT user_id FROM target_viewers)
          AND car_id != :carId
        GROUP BY car_id
        ORDER BY co_view_count DESC
        LIMIT :limit;
      `;
      const coViewed = await sequelize.query(coViewQuery, {
        replacements: { carId, limit },
        type: sequelize.QueryTypes.SELECT
      });
      recommendedCarIds = coViewed.map(r => r.car_id);
    } catch (e) {
      console.error('Collab filtering error:', e);
    }

    // Method 3: Trending Fallback (if Collab yields nothing)
    if (recommendedCarIds.length === 0) {
      try {
        const trendingQuery = `
          SELECT car_id, COUNT(*) as view_count
          FROM views
          WHERE timestamp >= NOW() - INTERVAL 7 DAY
            AND car_id != :carId
          GROUP BY car_id
          ORDER BY view_count DESC
          LIMIT :limit;
        `;
        const trending = await sequelize.query(trendingQuery, {
          replacements: { carId, limit },
          type: sequelize.QueryTypes.SELECT
        });
        recommendedCarIds = trending.map(r => r.car_id);
      } catch (e) {
        console.error('Trending error:', e);
      }
    }

    // Fetch car details for recommendedCarIds
    if (recommendedCarIds.length > 0) {
      const recCars = await Car.findAll({
        where: {
          id: { [Op.in]: recommendedCarIds },
          status: 'active'
        },
        attributes: [
          'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'price_negotiable',
          'km_driven', 'fuel_type', 'transmission', 'ownership', 'status',
          'created_at', 'brand_id', 'body_type',
          'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
        ],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'], where: { is_primary: true }, required: false },
          { model: State, as: 'state', attributes: ['name'] },
          { model: District, as: 'district', attributes: ['name'] },
          { model: City, as: 'city', attributes: ['name'] }
        ]
      });

      // Order correctly based on the ids
      recommendedCarsData = recommendedCarIds.map(id => recCars.find(c => c.id === id)).filter(Boolean);
    } else {
      recommendedCarsData = [];
    }

    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(cacheKeyRecommended, 300, JSON.stringify(recommendedCarsData));
      }
    } catch (err) { }
  }

  // Deduplication: Keep in similar, remove from recommended
  const similarIds = new Set(similarCarsData.data.map(c => c.id));
  recommendedCarsData = recommendedCarsData.filter(c => !similarIds.has(c.id));

  return {
    similarCars: similarCarsData,
    recommendedCars: recommendedCarsData
  };
};