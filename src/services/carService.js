const { Car, CarImage, User, DealerProfile, Wishlist, Lead, View, State, District, City, Brand, Model, Variant, CarStat, Highlight } = require('../models');
const { Op, Sequelize, fn, col, where } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const notificationQueue = require('../queues/notificationQueue');
const {
  extractPublicIdFromUrl,
  getOptimizedCloudinaryUrl,
  deleteCloudinaryMedia,
} = require('../utils/cloudinaryHelper');

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
      for await (const chunk of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        const batch = Array.isArray(chunk) ? chunk.filter(Boolean) : (chunk ? [chunk] : []);
        if (batch.length > 0) {
          await redisClient.del(batch);
        }
      }
    }
  } catch (err) {
    console.error('Redis clear pattern error:', err);
  }
};

/**
 * Universal cache invalidator for car mutations
 */
const invalidateCarCaches = async (carId = null, userId = null, oldUserId = null) => {
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

    // Invalidate dealer namespace (covers dealer:{uuid}:filters:* and dealer:{uuid}:cars:*)
    if (userId) {
      await clearCachePattern(`dealer:${userId}:*`);
    }
    if (oldUserId && oldUserId !== userId) {
      await clearCachePattern(`dealer:${oldUserId}:*`);
    }

    // 2. HTTP middleware cache keys
    const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
    await clearHttpCache('/api/v1/cars');
    await clearHttpCache('/api/v1/catalog');
    if (userId) {
      await clearHttpCache(`/api/v1/dealers/${userId}/cars`);
    }
    if (oldUserId && oldUserId !== userId) {
      await clearHttpCache(`/api/v1/dealers/${oldUserId}/cars`);
    }

    // 3. User Dashboard summary cache
    if (userId) {
      const dashboardService = require('./dashboardService');
      await dashboardService.invalidateDashboardCache(userId);
    }
    if (oldUserId && oldUserId !== userId) {
      const dashboardService = require('./dashboardService');
      await dashboardService.invalidateDashboardCache(oldUserId);
    }
  } catch (err) {
    console.error('Car cache invalidation error:', err);
  }
};
const {
  mapToDbValues,
  FUEL_TYPE_MAP,
  TRANSMISSION_MAP,
  BODY_TYPE_MAP,
  OWNERSHIP_MAP,
  BOARD_TYPE_MAP,
} = require('../validations/carValidation');

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
 * Helper to transform car images into absolute Cloudinary URLs and flatten seller district & company_name
 * Ensures NO local filesystem paths (D:/..., /uploads/...) or server hostnames are returned.
 */
const transformCarImages = (car, baseUrl = null) => {
  if (!car) return null;
  const rawImages = car.images || [];

  // Filter out any broken local paths or non-Cloudinary images
  const validImages = [];
  for (const img of rawImages) {
    const item = typeof img.toJSON === 'function' ? img.toJSON() : { ...img };
    const rawUrl = item.image_url;
    if (!rawUrl || typeof rawUrl !== 'string') continue;
    // Disallow local disk paths and internal server uploads
    if (rawUrl.match(/^[a-zA-Z]:[/\\]/) || rawUrl.includes('/uploads/') || rawUrl.includes('uploads\\')) {
      continue;
    }
    const optimized = getOptimizedCloudinaryUrl(rawUrl, { width: 800 });
    if (!optimized) continue;
    validImages.push({
      id: item.id,
      image_url: optimized,
      is_primary: Boolean(item.is_primary),
      public_id: item.public_id || extractPublicIdFromUrl(optimized),
    });
  }

  // Determine primary image
  const primaryItem = validImages.find((img) => img.is_primary === true) || validImages[0] || null;
  const secondaryImages = validImages.filter((img) => img !== primaryItem).map((img) => img.image_url);

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

  // Resolve and format State, District, City / Cities
  let stateObj = carJson.state || (car.state ? (typeof car.state.toJSON === 'function' ? car.state.toJSON() : car.state) : null);
  let districtObj = carJson.district || (car.district ? (typeof car.district.toJSON === 'function' ? car.district.toJSON() : car.district) : null);
  let cityObj = carJson.city || carJson.cities || (car.city ? (typeof car.city.toJSON === 'function' ? car.city.toJSON() : car.city) : null) || (car.cities ? (typeof car.cities.toJSON === 'function' ? car.cities.toJSON() : car.cities) : null);

  if (typeof stateObj === 'string') stateObj = { name: stateObj };
  if (typeof districtObj === 'string') districtObj = { name: districtObj };
  if (typeof cityObj === 'string') cityObj = { name: cityObj };

  // Fallback to seller location if car's direct location fields are not present
  const rawSeller = car.seller;
  if (!districtObj && (rawSeller?.district || rawSeller?.districtDetail || carJson.seller?.district)) {
    const sDist = rawSeller?.districtDetail || rawSeller?.district || carJson.seller?.district;
    districtObj = typeof sDist === 'object' ? (typeof sDist.toJSON === 'function' ? sDist.toJSON() : sDist) : { name: sDist };
  }
  if (!cityObj && (rawSeller?.cityDetail || rawSeller?.city || carJson.seller?.city)) {
    const sCity = rawSeller?.cityDetail || rawSeller?.city || carJson.seller?.city;
    cityObj = typeof sCity === 'object' ? (typeof sCity.toJSON === 'function' ? sCity.toJSON() : sCity) : { name: sCity };
  }
  if (!stateObj && (rawSeller?.stateDetail || rawSeller?.state || carJson.seller?.state)) {
    const sState = rawSeller?.stateDetail || rawSeller?.state || carJson.seller?.state;
    stateObj = typeof sState === 'object' ? (typeof sState.toJSON === 'function' ? sState.toJSON() : sState) : { name: sState };
  }

  // Cross-derive hierarchy if partial location info is available
  if (cityObj && typeof cityObj === 'object') {
    if (!districtObj && (cityObj.district || cityObj.districtDetail)) {
      districtObj = cityObj.district || cityObj.districtDetail;
    }
    if (!stateObj && (cityObj.state || cityObj.stateDetail)) {
      stateObj = cityObj.state || cityObj.stateDetail;
    }
  }
  if (districtObj && typeof districtObj === 'object') {
    if (!stateObj && (districtObj.state || districtObj.stateDetail)) {
      stateObj = districtObj.state || districtObj.stateDetail;
    }
  }

  const districtName = districtObj?.name || null;
  const cityName = cityObj?.name || null;
  const stateName = stateObj?.name || null;
  const locationText = [cityName, districtName, stateName].filter(Boolean).join(', ') || carJson.location_text || null;

  carJson.state = stateObj;
  carJson.district = districtObj;
  carJson.city = cityObj;
  carJson.cities = cityObj; // alias requested: "we need district, cities, state"
  carJson.districtName = districtName;
  carJson.cityName = cityName;
  carJson.stateName = stateName;
  carJson.district_name = districtName;
  carJson.city_name = cityName;
  carJson.state_name = stateName;
  carJson.location_text = locationText;

  // Attach icon URL directly for body type
  const normalizedBodyType = carJson.body_type ? carJson.body_type.toString().toLowerCase().trim() : '';
  const matchedIcon = CAR_TYPE_ICONS[normalizedBodyType]
    || CAR_TYPE_ICONS[normalizedBodyType.replace(/[\s-]+/g, '_')]
    || null;
  const optimizedIconUrl = matchedIcon ? getOptimizedCloudinaryUrl(matchedIcon, { width: 800 }) || matchedIcon : null;

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

  const formatMediaUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.match(/^[a-zA-Z]:[/\\]/) || url.includes('/uploads/') || url.includes('uploads\\')) {
      return null;
    }
    if (url.startsWith('https://res.cloudinary.com/')) {
      return url;
    }
    if (url.startsWith('http://res.cloudinary.com/')) {
      return url.replace('http://', 'https://');
    }
    return null;
  };

  const previousPrice = (carJson.previous_price !== null && carJson.previous_price !== undefined)
    ? Number(carJson.previous_price)
    : null;
  const price = (carJson.price !== null && carJson.price !== undefined)
    ? Number(carJson.price)
    : carJson.price;
  const hasPriceDrop = Boolean(carJson.has_price_drop);

  return {
    ...carJson,
    price,
    previous_price: previousPrice,
    has_price_drop: hasPriceDrop,
    video_url: formatMediaUrl(carJson.video_url),
    audio_url: formatMediaUrl(carJson.audio_url),
    highlights: carJson.highlights || [],
    primary_image: primaryItem ? primaryItem.image_url : null,
    secondary_images: secondaryImages,
    images: validImages,
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

const {
  isUuid,
  fetchExternalJson,
  EXTERNAL_CATALOG_API,
  normalizeTransmission,
  normalizeFuelType,
  resolveBrandId,
  resolveModelId,
  resolveVariantId,
} = require('../utils/idResolver');

exports.resolveBrandId = resolveBrandId;
exports.resolveModelId = resolveModelId;
exports.resolveVariantId = resolveVariantId;
exports.clearCachePattern = clearCachePattern;

/**
 * Create a car listing with auto-assigned posted_by_type and b2b_listing logic
 */
exports.createCar = async (userId, carData, files) => {
  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found.', 404);

    const mapped = mapToDbValues(carData);

    const brandInput = mapped.brand_id !== undefined && mapped.brand_id !== null && mapped.brand_id !== ''
      ? mapped.brand_id
      : mapped.brand;
    const brandId = await resolveBrandId(brandInput, transaction);
    if (!brandId) throw new AppError('Brand ID or brand name is required.', 400);

    const modelInput = mapped.model_id !== undefined && mapped.model_id !== null && mapped.model_id !== ''
      ? mapped.model_id
      : mapped.model;
    const modelId = await resolveModelId(modelInput, brandId, mapped.body_type || 'SUV', transaction);
    if (!modelId) throw new AppError('Model ID or model name is required.', 400);

    const normalizedTransmission = normalizeTransmission(mapped.transmission) || mapped.transmission || 'Manual';

    const variantInput = mapped.variant_id !== undefined && mapped.variant_id !== null && mapped.variant_id !== ''
      ? mapped.variant_id
      : mapped.variant;
    const variantId = await resolveVariantId(
      variantInput,
      modelId,
      {
        fuel_type: mapped.fuel_type,
        transmission: normalizedTransmission,
        price: mapped.price,
      },
      transaction
    );

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
      const city = await City.findByPk(cityId, { transaction });
      if (city) {
        if (!districtId && city.district_id) districtId = city.district_id;
        if (!stateId && city.state_id) stateId = city.state_id;
      } else {
        cityId = null;
      }
    }

    if (stateId) {
      const stateExists = await State.findByPk(stateId, { transaction });
      if (!stateExists) stateId = null;
    }

    const getFileUrl = (f) => {
      if (!f) return null;
      const url = typeof f === 'string' ? f : (f.path || f.secure_url || f.url);
      if (typeof url === 'string') {
        const clean = url.trim();
        if (clean.startsWith('https://res.cloudinary.com/') || clean.startsWith('http://res.cloudinary.com/')) {
          return clean.replace('http://', 'https://');
        }
      }
      return null;
    };

    const getFilePublicId = (f, url) => {
      if (f && typeof f === 'object') {
        if (f.filename && typeof f.filename === 'string' && !f.filename.includes('\\') && !f.filename.includes('/uploads/')) {
          return f.filename;
        }
        if (f.public_id && typeof f.public_id === 'string') {
          return f.public_id;
        }
      }
      return extractPublicIdFromUrl(url);
    };

    // Logging video file info
    if (files && files.video && files.video[0]) {
      console.log('📹 Video file received:', {
        originalname: files.video[0].originalname,
        size: files.video[0].size,
        mimetype: files.video[0].mimetype,
      });
    } else {
      console.log('📹 No video file provided');
    }
    // Logging audio file info
    if (files && files.audio && files.audio[0]) {
      console.log('🎵 Audio file received:', {
        originalname: files.audio[0].originalname,
        size: files.audio[0].size,
        mimetype: files.audio[0].mimetype,
      });
    } else {
      console.log('🎵 No audio file provided');
    }
    const videoUrl = files && files.video && files.video[0] ? getFileUrl(files.video[0]) : null;
    const audioUrl = files && files.audio && files.audio[0] ? getFileUrl(files.audio[0]) : null;
    console.log('✅ Resolved URLs -> video:', videoUrl, 'audio:', audioUrl);
    // Validate that if a file was provided, a URL was obtained
    if (files && files.video && files.video[0] && !videoUrl) {
      throw new AppError('Failed to upload video file. Please check Cloudinary configuration.', 500);
    }
    if (files && files.audio && files.audio[0] && !audioUrl) {
      throw new AppError('Failed to upload audio file. Please check Cloudinary configuration.', 500);
    }

    const carFields = {
      ...(carData.id ? { id: carData.id } : {}),
      user_id: userId,
      brand_id: brandId,
      model_id: modelId,
      variant_id: variantId,
      year: mapped.year,
      price: mapped.price,
      price_negotiable: mapped.price_negotiable || false,
      km_driven: mapped.km_driven,
      fuel_type: mapped.fuel_type,
      transmission: normalizedTransmission,
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
      video_url: videoUrl,
      audio_url: audioUrl,
      state_id: stateId,
      district_id: districtId,
      city_id: cityId,
    };

    const car = await Car.create(carFields, { transaction });

    const imageRecords = [];
    if (files && files.primary_image && files.primary_image[0]) {
      const pUrl = getFileUrl(files.primary_image[0]);
      if (pUrl) {
        imageRecords.push({
          car_id: car.id,
          image_url: pUrl,
          public_id: getFilePublicId(files.primary_image[0], pUrl),
          is_primary: true,
        });
      }
    } else if (files && files.images && files.images.length > 0) {
      const pUrl = getFileUrl(files.images[0]);
      if (pUrl) {
        imageRecords.push({
          car_id: car.id,
          image_url: pUrl,
          public_id: getFilePublicId(files.images[0], pUrl),
          is_primary: true,
        });
      }
    } else if (carData.primary_image && typeof carData.primary_image === 'string') {
      const pUrl = getFileUrl(carData.primary_image);
      if (pUrl) {
        imageRecords.push({
          car_id: car.id,
          image_url: pUrl,
          public_id: getFilePublicId(carData.primary_image, pUrl),
          is_primary: true,
        });
      }
    } else if (Array.isArray(carData.images) && carData.images.length > 0) {
      const pUrl = getFileUrl(carData.images[0]);
      if (pUrl) {
        imageRecords.push({
          car_id: car.id,
          image_url: pUrl,
          public_id: getFilePublicId(carData.images[0], pUrl),
          is_primary: true,
        });
      }
    }

    const secondaryFiles = files ? files.images || [] : [];
    const startIdx = (files && (!files.primary_image || !files.primary_image[0]) && files.images && files.images.length > 0) ? 1 : 0;
    for (let i = startIdx; i < secondaryFiles.length; i++) {
      const sUrl = getFileUrl(secondaryFiles[i]);
      if (sUrl) {
        imageRecords.push({
          car_id: car.id,
          image_url: sUrl,
          public_id: getFilePublicId(secondaryFiles[i], sUrl),
          is_primary: false,
        });
      }
    }

    if ((!files || !files.images || files.images.length === 0) && Array.isArray(carData.images)) {
      const bodyStartIdx = (!carData.primary_image && carData.images.length > 0) ? 1 : 0;
      for (let i = bodyStartIdx; i < carData.images.length; i++) {
        const item = carData.images[i];
        const sUrl = getFileUrl(item);
        if (sUrl) {
          imageRecords.push({
            car_id: car.id,
            image_url: sUrl,
            public_id: getFilePublicId(item, sUrl),
            is_primary: false,
          });
        }
      }
    }

    if (imageRecords.length > 0) {
      await CarImage.bulkCreate(imageRecords, { transaction });
    }

    const highlightIds = mapped.highlight_ids || carData.highlight_ids;
    if (highlightIds && Array.isArray(highlightIds) && highlightIds.length > 0) {
      const foundHighlights = await Highlight.findAll({
        where: { id: { [Op.in]: highlightIds } },
        attributes: ['id'],
        transaction,
      });
      if (foundHighlights.length !== highlightIds.length) {
        throw new AppError('One or more highlight IDs are invalid.', 400);
      }
      await car.setHighlights(highlightIds, { transaction });
    }

    await transaction.commit();

    const createdCar = await Car.findByPk(car.id, {
      include: [
        { model: CarImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'city'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: Highlight, as: 'highlights', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
    });

    await invalidateCarCaches(createdCar.id, userId);

    // Add job to match requirements
    notificationQueue.add({ carId: createdCar.id }).catch(err => {
      console.error('Failed to enqueue car matching job:', err);
    });

    return transformCarImages(createdCar);
  } catch (error) {
    console.error('❌ CREATE CAR SERVICE ERROR:', error);
    await transaction.rollback();
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new AppError('Foreign key constraint error: Brand, Model, Variant, or Location not found in database.', 400);
    }
    if (error.name === 'SequelizeValidationError') {
      throw new AppError(error.errors?.[0]?.message || 'Database validation error', 400);
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('Duplicate record detected for this car listing.', 400);
    }
    if (error.name === 'SequelizeDatabaseError') {
      if (/unknown column/i.test(error.message) || /column.*does not exist/i.test(error.message)) {
        throw new AppError(`Database schema out of sync: ${error.message}. Please run database migrations on server.`, 500);
      }
      throw new AppError(`Database error: ${error.message}`, 500);
    }
    throw new AppError(error.message || 'Failed to create car listing.', error.statusCode || 500);
  }
};

/**
 * Unifies car filter resolution and builds Sequelize whereClause & queryModel
 * Used across public getCars, user-scoped getUserCars, and admin getAdminCars
 */
const buildCarFiltersWhere = async (rawFilters = {}, { isUserScope = false, userId = null, userRole = null } = {}) => {
  const filters = {};
  for (const [key, value] of Object.entries(rawFilters || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    filters[key] = value;
  }

  const where = {};
  let queryModel = Car;

  // 1. Status Scoping
  const rawStatus = filters.status ? String(filters.status).trim().toLowerCase() : null;
  if (isUserScope) {
    if (userId) {
      where.user_id = userId;
    }
    if (rawStatus && rawStatus !== 'all') {
      where.status = rawStatus;
      if (rawStatus === 'deleted') {
        queryModel = Car.unscoped();
      }
    } else if (rawStatus === 'all') {
      queryModel = Car.unscoped();
    }
  } else {
    // Public or admin feed
    if (rawStatus && rawStatus !== 'all') {
      where.status = rawStatus;
      if (rawStatus === 'deleted') {
        queryModel = Car.unscoped();
      }
    } else if (rawStatus === 'all') {
      if (userRole === 'admin') {
        queryModel = Car.unscoped();
      } else {
        where.status = { [Op.ne]: 'deleted' };
      }
    } else {
      where.status = 'active';
    }
  }

  // 2. User / Seller / Posted by me filters (for public/admin feeds)
  if (!isUserScope) {
    if (filters.user_id) {
      if (userRole === 'admin' || filters.user_id === 'me') {
        const targetUserId = filters.user_id === 'me' ? userId : filters.user_id;
        if (targetUserId) where.user_id = targetUserId;
      }
    } else if (filters.seller_id) {
      if (userRole === 'admin' || filters.seller_id === 'me') {
        const targetSellerId = filters.seller_id === 'me' ? userId : filters.seller_id;
        if (targetSellerId) where.user_id = targetSellerId;
      }
    } else if (filters.posted_by_me === true || filters.posted_by_me === 'true' || filters.mine === true || filters.mine === 'true') {
      if (userId) where.user_id = userId;
    }
  }

  // 3. Search query (across number_plate, color, description, brand name, model name)
  if (filters.search || filters.q) {
    const searchTerm = String(filters.search || filters.q).trim();
    if (searchTerm) {
      const sanitized = searchTerm.replace(/'/g, "''");
      const searchWhere = [
        { number_plate: { [Op.like]: `%${searchTerm}%` } },
        { color: { [Op.like]: `%${searchTerm}%` } },
        { description: { [Op.like]: `%${searchTerm}%` } },
        sequelize.literal(`EXISTS (SELECT 1 FROM brands WHERE brands.id = Car.brand_id AND brands.name LIKE '%${sanitized}%')`),
        sequelize.literal(`EXISTS (SELECT 1 FROM models WHERE models.id = Car.model_id AND models.name LIKE '%${sanitized}%')`),
      ];
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push({ [Op.or]: searchWhere });
    }
  }

  // 4. Posted by type
  if (filters.posted_by_type && ['dealer', 'customer'].includes(String(filters.posted_by_type).toLowerCase())) {
    where.posted_by_type = String(filters.posted_by_type).toLowerCase();
  }

  // 5. B2B & Board type
  if (filters.b2b_listing !== undefined) {
    where.b2b_listing = filters.b2b_listing === 'true' || filters.b2b_listing === true;
  } else if (filters.b2b !== undefined) {
    where.b2b_listing = filters.b2b === 'true' || filters.b2b === true;
  }

  if (filters.has_price_drop !== undefined) {
    where.has_price_drop = filters.has_price_drop === 'true' || filters.has_price_drop === true;
  }

  if (filters.board_types && filters.board_types.length) {
    const boards = (Array.isArray(filters.board_types) ? filters.board_types : String(filters.board_types).split(','))
      .map(b => String(b).trim())
      .filter(Boolean);
    if (boards.length) {
      where.board_type = { [Op.in]: boards };
    }
  } else if (filters.board_type) {
    const bt = String(filters.board_type).trim();
    if (bt.toUpperCase() === 'B2B') {
      where.b2b_listing = true;
    } else {
      where.board_type = bt;
    }
  }

  // 6. Price range & exact price
  const exactPrice = filters.price;
  if (exactPrice !== undefined && exactPrice !== null && exactPrice !== '') {
    const parsedPrice = parseFloat(exactPrice);
    if (!isNaN(parsedPrice)) where.price = parsedPrice;
  } else {
    const minPrice = filters.min_price ?? filters.minPrice;
    const maxPrice = filters.max_price ?? filters.maxPrice;
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      const parsedMin = parseFloat(minPrice);
      if (!isNaN(parsedMin)) {
        where.price = { ...(where.price || {}), [Op.gte]: parsedMin };
      }
    }
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      const parsedMax = parseFloat(maxPrice);
      if (!isNaN(parsedMax)) {
        where.price = { ...(where.price || {}), [Op.lte]: parsedMax };
      }
    }
  }

  // 7. Year range & exact year
  const exactYear = filters.year;
  if (exactYear !== undefined && exactYear !== null && exactYear !== '') {
    const parsedYear = parseInt(exactYear, 10);
    if (!isNaN(parsedYear)) where.year = parsedYear;
  } else {
    const minYear = filters.min_year ?? filters.minYear;
    const maxYear = filters.max_year ?? filters.maxYear;
    if (minYear !== undefined && minYear !== null && minYear !== '') {
      const parsedMinY = parseInt(minYear, 10);
      if (!isNaN(parsedMinY)) {
        where.year = { ...(where.year || {}), [Op.gte]: parsedMinY };
      }
    }
    if (maxYear !== undefined && maxYear !== null && maxYear !== '') {
      const parsedMaxY = parseInt(maxYear, 10);
      if (!isNaN(parsedMaxY)) {
        where.year = { ...(where.year || {}), [Op.lte]: parsedMaxY };
      }
    }
  }

  // 8. KM Driven range & exact km
  const exactKm = filters.km_driven ?? filters.kmdriven;
  if (exactKm !== undefined && exactKm !== null && exactKm !== '') {
    const parsedKm = parseFloat(exactKm);
    if (!isNaN(parsedKm)) where.km_driven = parsedKm;
  } else {
    const minKm = filters.min_km ?? filters.minKm;
    const maxKm = filters.max_km ?? filters.maxKm;
    if (minKm !== undefined && minKm !== null && minKm !== '') {
      const parsedMinKm = parseFloat(minKm);
      if (!isNaN(parsedMinKm)) {
        where.km_driven = { ...(where.km_driven || {}), [Op.gte]: parsedMinKm };
      }
    }
    if (maxKm !== undefined && maxKm !== null && maxKm !== '') {
      const parsedMaxKm = parseFloat(maxKm);
      if (!isNaN(parsedMaxKm)) {
        where.km_driven = { ...(where.km_driven || {}), [Op.lte]: parsedMaxKm };
      }
    }
  }

  // 9. Brands filter (supports brands array/csv, brand_id, brand name/id)
  if (filters.brands && filters.brands.length) {
    const brandItems = Array.isArray(filters.brands) ? filters.brands : String(filters.brands).split(',');
    const resolvedBrandIds = [];
    const numericBrandIds = [];
    const nameBrandItems = [];

    for (const item of brandItems) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      if (isUuid(trimmed)) {
        resolvedBrandIds.push(trimmed);
      } else {
        if (/^\d+$/.test(trimmed)) {
          numericBrandIds.push(parseInt(trimmed, 10));
        }
        nameBrandItems.push(trimmed);
      }
    }

    if (numericBrandIds.length || nameBrandItems.length) {
      const foundBrands = await Brand.findAll({
        where: {
          [Op.or]: [
            ...(nameBrandItems.length ? [{ name: { [Op.in]: nameBrandItems } }] : []),
            ...(numericBrandIds.length ? [{ external_id: { [Op.in]: numericBrandIds } }] : []),
          ],
        },
        attributes: ['id'],
      });
      resolvedBrandIds.push(...foundBrands.map(b => b.id));
    }

    const uniqueBrandIds = [...new Set(resolvedBrandIds)];
    where.brand_id = { [Op.in]: uniqueBrandIds.length ? uniqueBrandIds : ['00000000-0000-0000-0000-000000000000'] };
  } else if (filters.brand_id) {
    const brandStr = String(filters.brand_id).trim();
    if (isUuid(brandStr)) {
      where.brand_id = brandStr;
    } else {
      const brand = await Brand.findOne({
        where: {
          [Op.or]: [
            { name: brandStr },
            ...(/^\d+$/.test(brandStr) ? [{ external_id: parseInt(brandStr, 10) }] : []),
          ],
        },
        attributes: ['id'],
      });
      where.brand_id = brand ? brand.id : '00000000-0000-0000-0000-000000000000';
    }
  } else if (filters.brand) {
    const brandStr = String(filters.brand).trim();
    if (isUuid(brandStr)) {
      where.brand_id = brandStr;
    } else {
      const brand = await Brand.findOne({
        where: {
          [Op.or]: [
            { name: brandStr },
            ...(/^\d+$/.test(brandStr) ? [{ external_id: parseInt(brandStr, 10) }] : []),
          ],
        },
        attributes: ['id'],
      });
      where.brand_id = brand ? brand.id : '00000000-0000-0000-0000-000000000000';
    }
  }

  // 10. Models filter (supports models array/csv, model_ids array/csv, model_id, model name/id)
  const rawModels = filters.models || filters.model_ids;
  if (rawModels && rawModels.length) {
    const modelItems = Array.isArray(rawModels) ? rawModels : String(rawModels).split(',');
    const resolvedModelIds = [];
    const numericModelIds = [];
    const nameModelItems = [];

    for (const item of modelItems) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      if (isUuid(trimmed)) {
        resolvedModelIds.push(trimmed);
      } else {
        if (/^\d+$/.test(trimmed)) {
          numericModelIds.push(parseInt(trimmed, 10));
        }
        nameModelItems.push(trimmed);
      }
    }

    if (numericModelIds.length || nameModelItems.length) {
      const foundModels = await Model.findAll({
        where: {
          [Op.or]: [
            ...(nameModelItems.length ? [{ name: { [Op.in]: nameModelItems } }] : []),
            ...(numericModelIds.length ? [{ external_id: { [Op.in]: numericModelIds } }] : []),
          ],
        },
        attributes: ['id'],
      });
      resolvedModelIds.push(...foundModels.map(m => m.id));
    }

    const uniqueModelIds = [...new Set(resolvedModelIds)];
    where.model_id = { [Op.in]: uniqueModelIds.length ? uniqueModelIds : ['00000000-0000-0000-0000-000000000000'] };
  } else if (filters.model_id) {
    const modelStr = String(filters.model_id).trim();
    if (isUuid(modelStr)) {
      where.model_id = modelStr;
    } else {
      const model = await Model.findOne({
        where: {
          [Op.or]: [
            { name: modelStr },
            ...(/^\d+$/.test(modelStr) ? [{ external_id: parseInt(modelStr, 10) }] : []),
          ],
        },
        attributes: ['id'],
      });
      where.model_id = model ? model.id : '00000000-0000-0000-0000-000000000000';
    }
  } else if (filters.model) {
    const modelStr = String(filters.model).trim();
    if (isUuid(modelStr)) {
      where.model_id = modelStr;
    } else {
      const foundModel = await Model.findOne({
        where: {
          [Op.or]: [
            { name: modelStr },
            { name: { [Op.like]: `${modelStr}%` } },
            ...(/^\d+$/.test(modelStr) ? [{ external_id: parseInt(modelStr, 10) }] : []),
          ],
        },
        attributes: ['id'],
      });
      where.model_id = foundModel ? foundModel.id : '00000000-0000-0000-0000-000000000000';
    }
  }

  // 11. Variants filter (supports variants array/csv, variant_ids array/csv, variant_id, variant name/id)
  const rawVariants = filters.variants || filters.variant_ids;
  if (rawVariants && rawVariants.length) {
    const variantItems = Array.isArray(rawVariants) ? rawVariants : String(rawVariants).split(',');
    const resolvedVariantIds = [];
    const numericVariantIds = [];
    const nameVariantItems = [];

    for (const item of variantItems) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      if (isUuid(trimmed)) {
        resolvedVariantIds.push(trimmed);
      } else {
        if (/^\d+$/.test(trimmed)) {
          numericVariantIds.push(parseInt(trimmed, 10));
        }
        nameVariantItems.push(trimmed);
      }
    }

    if (numericVariantIds.length || nameVariantItems.length) {
      const foundVariants = await Variant.findAll({
        where: {
          [Op.or]: [
            ...(nameVariantItems.length ? [{ name: { [Op.in]: nameVariantItems } }] : []),
            ...(numericVariantIds.length ? [{ external_id: { [Op.in]: numericVariantIds } }] : []),
          ],
        },
        attributes: ['id'],
      });
      resolvedVariantIds.push(...foundVariants.map(v => v.id));
    }

    const uniqueVariantIds = [...new Set(resolvedVariantIds)];
    where.variant_id = { [Op.in]: uniqueVariantIds.length ? uniqueVariantIds : ['00000000-0000-0000-0000-000000000000'] };
  } else if (filters.variant_id) {
    const variantStr = String(filters.variant_id).trim();
    if (isUuid(variantStr)) {
      where.variant_id = variantStr;
    } else {
      const variant = await Variant.findOne({
        where: {
          [Op.or]: [
            { name: variantStr },
            ...(/^\d+$/.test(variantStr) ? [{ external_id: parseInt(variantStr, 10) }] : []),
          ],
        },
        attributes: ['id'],
      });
      where.variant_id = variant ? variant.id : '00000000-0000-0000-0000-000000000000';
    }
  } else if (filters.variant) {
    const variantStr = String(filters.variant).trim();
    if (isUuid(variantStr)) {
      where.variant_id = variantStr;
    } else {
      const foundVariant = await Variant.findOne({
        where: {
          [Op.or]: [
            { name: variantStr },
            { name: { [Op.like]: `${variantStr}%` } },
            ...(/^\d+$/.test(variantStr) ? [{ external_id: parseInt(variantStr, 10) }] : []),
          ],
        },
        attributes: ['id'],
      });
      where.variant_id = foundVariant ? foundVariant.id : '00000000-0000-0000-0000-000000000000';
    }
  }

  // 12. Fuel types
  const rawFuelInput = filters.fuel_types || filters.fuel_type || filters.fueltype;
  if (rawFuelInput && (Array.isArray(rawFuelInput) || typeof rawFuelInput === 'string')) {
    const fuelList = Array.isArray(rawFuelInput) ? rawFuelInput : String(rawFuelInput).split(',');
    const resolvedFuels = new Set();
    fuelList.forEach(f => {
      const trimmed = String(f).trim();
      if (!trimmed) return;
      resolvedFuels.add(trimmed);
      const mapped = FUEL_TYPE_MAP[trimmed.toLowerCase()];
      if (mapped) resolvedFuels.add(mapped);
      resolvedFuels.add(trimmed.toLowerCase());
      resolvedFuels.add(trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase());
    });
    if (resolvedFuels.size) {
      where.fuel_type = { [Op.in]: Array.from(resolvedFuels) };
    }
  }

  // 13. Transmissions
  const rawTransInput = filters.transmissions || filters.transmission;
  if (rawTransInput && (Array.isArray(rawTransInput) || typeof rawTransInput === 'string')) {
    const transList = Array.isArray(rawTransInput) ? rawTransInput : String(rawTransInput).split(',');
    const transConditions = [];
    const directMatches = new Set();

    transList.forEach(t => {
      const trimmed = String(t).trim();
      if (!trimmed) return;
      directMatches.add(trimmed);
      const mapped = TRANSMISSION_MAP[trimmed.toLowerCase()];
      if (mapped) directMatches.add(mapped);
      directMatches.add(trimmed.toLowerCase());
      directMatches.add(trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase());

      if (trimmed.toLowerCase().startsWith('auto')) {
        transConditions.push({ transmission: { [Op.like]: 'Auto%' } });
      } else if (trimmed.toLowerCase().startsWith('manu')) {
        transConditions.push({ transmission: { [Op.like]: 'Manu%' } });
      }
    });

    if (directMatches.size) {
      transConditions.push({ transmission: { [Op.in]: Array.from(directMatches) } });
    }

    if (transConditions.length === 1) {
      Object.assign(where, transConditions[0]);
    } else if (transConditions.length > 1) {
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push({ [Op.or]: transConditions });
    }
  }

  // 14. Body types
  const rawBodyInput = filters.body_types || filters.body_type;
  if (rawBodyInput && (Array.isArray(rawBodyInput) || typeof rawBodyInput === 'string')) {
    const bodyList = Array.isArray(rawBodyInput) ? rawBodyInput : String(rawBodyInput).split(',');
    const resolvedBodies = new Set();
    bodyList.forEach(b => {
      const trimmed = String(b).trim();
      if (!trimmed) return;
      resolvedBodies.add(trimmed);
      const mapped = BODY_TYPE_MAP[trimmed.toLowerCase()];
      if (mapped) resolvedBodies.add(mapped);
      resolvedBodies.add(trimmed.toLowerCase());
      resolvedBodies.add(trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase());
    });
    if (resolvedBodies.size) {
      where.body_type = { [Op.in]: Array.from(resolvedBodies) };
    }
  }

  // 15. Ownerships
  const rawOwnInput = filters.ownerships || filters.ownership;
  if (rawOwnInput && (Array.isArray(rawOwnInput) || typeof rawOwnInput === 'string')) {
    const ownList = Array.isArray(rawOwnInput) ? rawOwnInput : String(rawOwnInput).split(',');
    const resolvedOwns = new Set();
    ownList.forEach(o => {
      const trimmed = String(o).trim();
      if (!trimmed) return;
      resolvedOwns.add(trimmed);
      const mapped = OWNERSHIP_MAP[trimmed.toLowerCase()];
      if (mapped) resolvedOwns.add(mapped);
      resolvedOwns.add(trimmed.toLowerCase());
    });
    if (resolvedOwns.size) {
      where.ownership = { [Op.in]: Array.from(resolvedOwns) };
    }
  }

  // 16. Colors
  const rawColorInput = filters.colors || filters.color;
  if (rawColorInput && (Array.isArray(rawColorInput) || typeof rawColorInput === 'string')) {
    const colorList = Array.isArray(rawColorInput) ? rawColorInput : String(rawColorInput).split(',');
    const resolvedColors = colorList.map(c => String(c).trim()).filter(Boolean);
    if (resolvedColors.length === 1) {
      where.color = { [Op.like]: `%${resolvedColors[0]}%` };
    } else if (resolvedColors.length > 1) {
      where.color = { [Op.in]: resolvedColors };
    }
  }

  // 17. Posted within days & Expired
  let minCreatedAt = null;
  if (filters.posted_within_days !== undefined && filters.posted_within_days !== null && filters.posted_within_days !== '') {
    const days = parseInt(filters.posted_within_days, 10);
    if (!isNaN(days) && days >= 1) {
      const date = new Date();
      date.setDate(date.getDate() - days);
      minCreatedAt = date;
    }
  }

  const includeExpired = filters.include_expired === true || filters.include_expired === 'true';
  const shouldEnforceExpiredCutoff = !includeExpired && (!isUserScope || filters.include_expired !== undefined);

  if (shouldEnforceExpiredCutoff) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (!minCreatedAt || ninetyDaysAgo > minCreatedAt) {
      minCreatedAt = ninetyDaysAgo;
    }
  }

  if (minCreatedAt) {
    where.created_at = { ...(where.created_at || {}), [Op.gte]: minCreatedAt };
  }

  // 18. Location: State, District, City
  // State
  const rawStateInput = filters.states || filters.state || filters.state_id;
  if (rawStateInput && (Array.isArray(rawStateInput) || typeof rawStateInput === 'string')) {
    const stateItems = Array.isArray(rawStateInput) ? rawStateInput : String(rawStateInput).split(',');
    const resolvedStateIds = [];
    const nameStateItems = [];
    for (const item of stateItems) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      if (isUuid(trimmed)) {
        resolvedStateIds.push(trimmed);
      } else {
        nameStateItems.push(trimmed);
      }
    }
    if (nameStateItems.length) {
      const foundStates = await State.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.in]: nameStateItems } },
            { code: { [Op.in]: nameStateItems } },
            ...nameStateItems.map(n => ({ name: { [Op.like]: `${n}%` } })),
          ],
        },
        attributes: ['id'],
      });
      resolvedStateIds.push(...foundStates.map(s => s.id));
    }
    const uniqueStateIds = [...new Set(resolvedStateIds)];
    where.state_id = { [Op.in]: uniqueStateIds.length ? uniqueStateIds : ['00000000-0000-0000-0000-000000000000'] };
  }

  // District
  const rawDistInput = filters.districts || filters.district || filters.district_id;
  if (rawDistInput && (Array.isArray(rawDistInput) || typeof rawDistInput === 'string')) {
    const distItems = Array.isArray(rawDistInput) ? rawDistInput : String(rawDistInput).split(',');
    const resolvedDistIds = [];
    const nameDistItems = [];
    for (const item of distItems) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      if (isUuid(trimmed)) {
        resolvedDistIds.push(trimmed);
      } else {
        nameDistItems.push(trimmed);
      }
    }
    if (nameDistItems.length) {
      const foundDists = await District.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.in]: nameDistItems } },
            ...nameDistItems.map(n => ({ name: { [Op.like]: `${n}%` } })),
          ],
        },
        attributes: ['id'],
      });
      resolvedDistIds.push(...foundDists.map(d => d.id));
    }
    const uniqueDistIds = [...new Set(resolvedDistIds)];
    where.district_id = { [Op.in]: uniqueDistIds.length ? uniqueDistIds : ['00000000-0000-0000-0000-000000000000'] };
  }

  // City / Cities
  const rawCityInput = filters.cities || filters.city || filters.city_id;
  if (rawCityInput && (Array.isArray(rawCityInput) || typeof rawCityInput === 'string')) {
    const cityItems = Array.isArray(rawCityInput) ? rawCityInput : String(rawCityInput).split(',');
    const resolvedCityIds = [];
    const nameCityItems = [];
    for (const item of cityItems) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      if (isUuid(trimmed)) {
        resolvedCityIds.push(trimmed);
      } else {
        nameCityItems.push(trimmed);
      }
    }
    if (nameCityItems.length) {
      const foundCities = await City.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.in]: nameCityItems } },
            ...nameCityItems.map(n => ({ name: { [Op.like]: `${n}%` } })),
          ],
        },
        attributes: ['id'],
      });
      resolvedCityIds.push(...foundCities.map(c => c.id));
    }
    const uniqueCityIds = [...new Set(resolvedCityIds)];
    where.city_id = { [Op.in]: uniqueCityIds.length ? uniqueCityIds : ['00000000-0000-0000-0000-000000000000'] };
  }

  // 19. Wishlist filters
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

  return { where, queryModel, sanitizedFilters: filters };
};

exports.buildCarFiltersWhere = buildCarFiltersWhere;

exports.getCars = async (
  rawFilters = {},
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  userId = null,
  userRole = null
) => {
  const { where, queryModel, sanitizedFilters } = await buildCarFiltersWhere(rawFilters, {
    isUserScope: false,
    userId,
    userRole,
  });

  const parsedPage = sanitizedFilters.page ? parseInt(sanitizedFilters.page, 10) : page;
  const parsedLimit = sanitizedFilters.limit ? parseInt(sanitizedFilters.limit, 10) : limit;
  const validSortCols = ['created_at', 'price', 'year', 'km_driven', 'status'];
  const validSort = sanitizedFilters.sortBy && validSortCols.includes(sanitizedFilters.sortBy) ? sanitizedFilters.sortBy : sortBy;
  const validOrder = sanitizedFilters.sortOrder && ['ASC', 'DESC'].includes(sanitizedFilters.sortOrder.toUpperCase()) ? sanitizedFilters.sortOrder.toUpperCase() : sortOrder;

  const cacheKey = `cars:list:${Buffer.from(JSON.stringify({ filters: sanitizedFilters, page: parsedPage, limit: parsedLimit, sortBy: validSort, sortOrder: validOrder })).toString('base64')}`;

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
    const offset = (parsedPage - 1) * parsedLimit;

    const queryResult = await queryModel.findAndCountAll({
      attributes: [
        'id', 'model_id', 'variant_id', 'year', 'price', 'previous_price', 'has_price_drop', 'price_negotiable', 'km_driven',
        'fuel_type', 'transmission', 'ownership', 'body_type', 'board_type',
        'insurance_expiry_date', 'insurance_type', 'b2b_listing', 'posted_by_type',
        'status', 'description', 'color', 'number_plate', 'prior_appointemnts',
        'video_url', 'audio_url',
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
        { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: City, as: 'cities', attributes: ['id', 'name'] },
        { model: Lead, as: 'leads', attributes: ['id'] },
        { model: Highlight, as: 'highlights', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
      limit: parsedLimit,
      offset,
      order: [[validSort, validOrder.toUpperCase()]],
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
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(count / parsedLimit),
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
        { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: City, as: 'cities', attributes: ['id', 'name'] },
        { model: Lead, as: 'leads', attributes: ['id'], required: false },
        { model: CarStat, as: 'stats', required: false },
        { model: Highlight, as: 'highlights', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
    });
    if (!car) throw new AppError('Car not found.', 404);

    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
    const baseTransformed = transformCarImages(car, baseUrl);

    // Compute live metrics (self-healing via ensureCarStats)
    const analyticsService = require('./analyticsService');
    let stats = car.stats;
    if (!stats) {
      stats = await analyticsService.ensureCarStats(car.id);
    }

    const [dbViewsCount, dbWishlistCount] = await Promise.all([
      View.count({ where: { car_id: car.id } }),
      Wishlist.count({ where: { car_id: car.id } }),
    ]);

    const viewsCount = stats?.views_count !== undefined ? Math.max(stats.views_count, dbViewsCount) : dbViewsCount;
    const wishlistCount = dbWishlistCount; // Single source of truth from base table
    const calls = stats?.calls_count || 0;
    const whatsapp = stats?.whatsapp_count || 0;
    const messages = stats?.messages_count || 0;
    const enquiriesCount = calls + whatsapp + messages + (stats?.enquiries_count || 0) || (car.leads?.length || 0);

    const metrics = {
      views: viewsCount,
      views_count: viewsCount,
      enquiries: enquiriesCount,
      enquiry_count: enquiriesCount,
      calls,
      calls_count: calls,
      whatsapp,
      whatsapp_count: whatsapp,
      messages,
      messages_count: messages,
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
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
      { model: City, as: 'cities', attributes: ['id', 'name'] },
      { model: Highlight, as: 'highlights', attributes: ['id', 'name'], through: { attributes: [] } },
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
  if (!userId) {
    throw new AppError('User ID is required to fetch user listings', 400);
  }

  const rawOptions = typeof options === 'string' ? { status: options } : (options || {});
  const { where, queryModel, sanitizedFilters } = await buildCarFiltersWhere(rawOptions, {
    isUserScope: true,
    userId,
  });

  const page = sanitizedFilters.page ? parseInt(sanitizedFilters.page, 10) : 1;
  const limit = sanitizedFilters.limit ? parseInt(sanitizedFilters.limit, 10) : 50;
  const cursor = sanitizedFilters.cursor || null;

  // Sorting
  const validSortCols = ['created_at', 'price', 'year', 'km_driven', 'status'];
  const sortBy = sanitizedFilters.sortBy && validSortCols.includes(sanitizedFilters.sortBy) ? sanitizedFilters.sortBy : 'created_at';
  const sortOrder = sanitizedFilters.sortOrder && ['ASC', 'DESC'].includes(sanitizedFilters.sortOrder.toUpperCase()) ? sanitizedFilters.sortOrder.toUpperCase() : 'DESC';

  // Keyset Cursor Pagination (High-Speed O(1) Seek for infinite scroll)
  if (cursor) {
    where.created_at = { ...(where.created_at || {}), [Op.lt]: new Date(cursor) };
  }

  const parsedLimit = parseInt(limit, 10);
  const queryOptions = {
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
      { model: City, as: 'cities', attributes: ['id', 'name'] },
      { model: Lead, as: 'leads', attributes: ['id'] },
      { model: CarStat, as: 'stats', required: false },
      { model: Highlight, as: 'highlights', attributes: ['id', 'name'], through: { attributes: [] } },
    ],
    order: [[sortBy, sortOrder]],
    limit: parsedLimit,
  };

  // If no cursor provided and standard page > 1 requested, use offset fallback
  if (!cursor && page > 1) {
    queryOptions.offset = (page - 1) * parsedLimit;
  }

  const total = await queryModel.count({ where });
  const cars = await queryModel.findAll(queryOptions);

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const analyticsService = require('./analyticsService');

  // Self-heal any missing stats on read so seller dashboard never reads false zeros
  for (const car of cars) {
    if (!car.stats) {
      car.stats = await analyticsService.ensureCarStats(car.id);
    }
  }

  const transformedCars = cars.map((car) => {
    const transformed = transformCarImages(car, baseUrl);
    const is_expired = transformed.created_at && (Date.now() - new Date(transformed.created_at).getTime()) > 90 * 24 * 60 * 60 * 1000;

    const stats = car.stats || {};
    const calls = stats.calls_count || 0;
    const whatsapp = stats.whatsapp_count || 0;
    const messages = stats.messages_count || 0;
    const otherEnquiries = stats.enquiries_count || 0;
    const totalLeads = calls + whatsapp + messages + otherEnquiries || (car.leads?.length || 0);

    return {
      ...transformed,
      enquiry_count: totalLeads,
      is_expired,
      metrics: {
        views: stats.views_count || 0,
        enquiries: totalLeads,
        calls,
        whatsapp,
        messages,
        wishlist_count: stats.wishlist_count || 0,
      },
    };
  });

  const lastCar = cars.length > 0 ? cars[cars.length - 1] : null;
  const next_cursor = lastCar && lastCar.created_at ? lastCar.created_at.toISOString() : null;

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    cars: transformedCars,
    total,
    totalPages,
    pagination: {
      total,
      totalPages,
      limit: parsedLimit,
      page: cursor ? null : page,
      next_cursor,
      has_more: cursor ? cars.length === parsedLimit : (page * parsedLimit < total),
    },
  };
};

/**
 * Update car listing
 */
exports.updateCar = async (carId, userId, updateData, files) => {
  const transaction = await sequelize.transaction();
  try {
    const car = await Car.findOne({
      where: { id: carId, user_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!car) throw new AppError('Car not found or unauthorized.', 404);

    const mapped = mapToDbValues(updateData || {});

    let brandId = car.brand_id;
    const brandInput = mapped.brand_id !== undefined && mapped.brand_id !== null && mapped.brand_id !== ''
      ? mapped.brand_id
      : mapped.brand;
    if (brandInput) {
      brandId = await resolveBrandId(brandInput, transaction);
    }

    let modelId = car.model_id;
    const modelInput = mapped.model_id !== undefined && mapped.model_id !== null && mapped.model_id !== ''
      ? mapped.model_id
      : mapped.model;
    if (modelInput) {
      modelId = await resolveModelId(
        modelInput,
        brandId,
        mapped.body_type || car.body_type || 'SUV',
        transaction
      );
    }

    const normalizedTransmission = mapped.transmission !== undefined
      ? (normalizeTransmission(mapped.transmission) || mapped.transmission)
      : undefined;

    let variantId = car.variant_id;
    const variantInput = mapped.variant_id !== undefined && mapped.variant_id !== null && mapped.variant_id !== ''
      ? mapped.variant_id
      : mapped.variant;
    if (variantInput) {
      variantId = await resolveVariantId(
        variantInput,
        modelId,
        {
          fuel_type: mapped.fuel_type || car.fuel_type,
          transmission: normalizedTransmission || car.transmission,
          price: mapped.price || car.price,
        },
        transaction
      );
    }

    const filteredData = {};
    if (brandId) filteredData.brand_id = brandId;
    if (modelId) filteredData.model_id = modelId;
    if (variantId) filteredData.variant_id = variantId;
    if (mapped.year !== undefined) filteredData.year = mapped.year;

    // Price Drop Tracking with dynamic threshold & price hike reset
    let hasPriceDropOccurred = false;
    if (mapped.price !== undefined && mapped.price !== null && mapped.price !== '') {
      const newPrice = Number(mapped.price);
      const currentPrice = Number(car.price);

      if (!isNaN(newPrice) && newPrice > 0) {
        // Dynamic drop threshold: MAX(₹5,000, 1% of current price)
        const minDropThreshold = Math.max(5000, currentPrice * 0.01);
        const priceDifference = currentPrice - newPrice;

        if (priceDifference >= minDropThreshold) {
          // Qualified price drop
          filteredData.previous_price = currentPrice;
          filteredData.has_price_drop = true;
          filteredData.price = newPrice;
          hasPriceDropOccurred = true;
        } else if (newPrice > currentPrice) {
          // Price hike / increase: reset price drop status to prevent inverted or stale discount
          filteredData.previous_price = null;
          filteredData.has_price_drop = false;
          filteredData.price = newPrice;
        } else {
          // Negligible price drop or unchanged price
          filteredData.price = newPrice;
          if (car.previous_price !== null && Number(car.previous_price) <= newPrice) {
            filteredData.previous_price = null;
            filteredData.has_price_drop = false;
          }
        }
      }
    }
    if (mapped.price_negotiable !== undefined) {
      filteredData.price_negotiable = mapped.price_negotiable === true || mapped.price_negotiable === 'true' || mapped.price_negotiable === 1 || mapped.price_negotiable === '1';
    }
    if (mapped.km_driven !== undefined) filteredData.km_driven = mapped.km_driven;
    if (mapped.fuel_type !== undefined) filteredData.fuel_type = mapped.fuel_type;
    if (normalizedTransmission !== undefined) filteredData.transmission = normalizedTransmission;
    if (mapped.ownership !== undefined) filteredData.ownership = mapped.ownership;
    if (mapped.body_type !== undefined) filteredData.body_type = mapped.body_type;
    if (mapped.board_type !== undefined) filteredData.board_type = mapped.board_type;
    if (mapped.insurance_expiry_date !== undefined) filteredData.insurance_expiry_date = mapped.insurance_expiry_date;
    if (mapped.insurance_type !== undefined) filteredData.insurance_type = mapped.insurance_type;
    if (mapped.b2b_listing !== undefined) {
      filteredData.b2b_listing = mapped.b2b_listing === true || mapped.b2b_listing === 'true' || mapped.b2b_listing === 1 || mapped.b2b_listing === '1';
    }
    if (mapped.status !== undefined) filteredData.status = mapped.status;
    if (mapped.engine_cc !== undefined) filteredData.engine_cc = mapped.engine_cc;
    if (mapped.description !== undefined) filteredData.description = mapped.description;
    if (mapped.color !== undefined) filteredData.color = mapped.color;
    if (mapped.number_plate !== undefined) filteredData.number_plate = mapped.number_plate;
    if (mapped.prior_appointemnts !== undefined) {
      filteredData.prior_appointemnts = mapped.prior_appointemnts === true || mapped.prior_appointemnts === 'true' || mapped.prior_appointemnts === 1 || mapped.prior_appointemnts === '1';
    }
    if (mapped.state_id !== undefined) filteredData.state_id = mapped.state_id || null;
    if (mapped.district_id !== undefined) filteredData.district_id = mapped.district_id || null;
    if (mapped.city_id !== undefined) filteredData.city_id = mapped.city_id || null;

    if (filteredData.district_id) {
      const dist = await District.findByPk(filteredData.district_id, { transaction });
      if (dist) {
        if (!filteredData.state_id) filteredData.state_id = dist.state_id;
        if (!filteredData.city_id) {
          const city = await City.findOne({ where: { district_id: filteredData.district_id }, transaction });
          if (city) filteredData.city_id = city.id;
        }
      }
    }
    if (filteredData.city_id) {
      const city = await City.findByPk(filteredData.city_id, { transaction });
      if (city) {
        if (!filteredData.district_id && city.district_id) filteredData.district_id = city.district_id;
        if (!filteredData.state_id && city.state_id) filteredData.state_id = city.state_id;
      }
    }

    if (files) {
      const getFileUrl = (f) => {
        if (!f) return null;
        const url = typeof f === 'string' ? f : (f.path || f.secure_url || f.url);
        if (typeof url === 'string') {
          const clean = url.trim();
          if (clean.startsWith('https://res.cloudinary.com/') || clean.startsWith('http://res.cloudinary.com/')) {
            return clean.replace('http://', 'https://');
          }
        }
        return null;
      };

      // Video: uploaded file takes precedence
      if (files.video && files.video[0]) {
        console.log('📹 Update - Video file received:', {
          originalname: files.video[0].originalname,
          size: files.video[0].size,
          mimetype: files.video[0].mimetype,
        });
        filteredData.video_url = getFileUrl(files.video[0]);
      } else {
        console.log('📹 Update - No video file provided');
      }
      // Validate video URL
      if (files && files.video && files.video[0] && !filteredData.video_url) {
        throw new AppError('Failed to upload video during update. Check Cloudinary settings.', 500);
      }
      // Log incoming audio file details
      if (files.audio && files.audio[0]) {
        console.log('🎵 Update - Audio file received:', {
          originalname: files.audio[0].originalname,
          size: files.audio[0].size,
          mimetype: files.audio[0].mimetype,
        });
        filteredData.audio_url = getFileUrl(files.audio[0]);
      } else {
        console.log('🎵 Update - No audio file provided');
      }
      // Validate audio URL
      if (files && files.audio && files.audio[0] && !filteredData.audio_url) {
        throw new AppError('Failed to upload audio during update. Check Cloudinary settings.', 500);
      }
      console.log('✅ Update - Resolved URLs -> video:', filteredData.video_url, 'audio:', filteredData.audio_url);
    }

    // Removal flags (only evaluated if no replacement file was provided)
    if (filteredData.video_url === undefined && (updateData.remove_video === true || updateData.remove_video === 'true' || updateData.video_url === null || updateData.video_url === '')) {
      filteredData.video_url = null;
    }
    if (filteredData.audio_url === undefined && (updateData.remove_audio === true || updateData.remove_audio === 'true' || updateData.audio_url === null || updateData.audio_url === '')) {
      filteredData.audio_url = null;
    }

    if (updateData.replace_images === true || updateData.replace_images === 'true') {
      const oldImages = await CarImage.findAll({ where: { car_id: car.id }, transaction });
      for (const oldImg of oldImages) {
        const pid = oldImg.public_id || extractPublicIdFromUrl(oldImg.image_url);
        if (pid) deleteCloudinaryMedia(pid).catch(() => {});
      }
      await CarImage.destroy({ where: { car_id: car.id }, transaction });
    } else if (updateData.images_to_keep !== undefined) {
      let imagesToKeep = updateData.images_to_keep;
      if (typeof imagesToKeep === 'string') {
        try {
          imagesToKeep = JSON.parse(imagesToKeep);
        } catch (e) {
          imagesToKeep = imagesToKeep ? [imagesToKeep] : [];
        }
      }
      if (Array.isArray(imagesToKeep)) {
        const toDelete = await CarImage.findAll({
          where: {
            car_id: car.id,
            id: { [Op.notIn]: imagesToKeep },
          },
          transaction,
        });
        for (const oldImg of toDelete) {
          const pid = oldImg.public_id || extractPublicIdFromUrl(oldImg.image_url);
          if (pid) deleteCloudinaryMedia(pid).catch(() => {});
        }
        await CarImage.destroy({
          where: {
            car_id: car.id,
            id: { [Op.notIn]: imagesToKeep },
          },
          transaction,
        });
      }
    }

    await car.update(filteredData, { transaction });

    if (files) {
      const getFileUrl = (f) => {
        if (!f) return null;
        const url = typeof f === 'string' ? f : (f.path || f.secure_url || f.url);
        if (typeof url === 'string') {
          const clean = url.trim();
          if (clean.startsWith('https://res.cloudinary.com/') || clean.startsWith('http://res.cloudinary.com/')) {
            return clean.replace('http://', 'https://');
          }
        }
        return null;
      };

      const getFilePublicId = (f, url) => {
        if (f && typeof f === 'object') {
          if (f.filename && typeof f.filename === 'string' && !f.filename.includes('\\') && !f.filename.includes('/uploads/')) {
            return f.filename;
          }
          if (f.public_id && typeof f.public_id === 'string') {
            return f.public_id;
          }
        }
        return extractPublicIdFromUrl(url);
      };

      const imageRecords = [];

      if (files.primary_image && files.primary_image[0]) {
        // Destroy old primary image on Cloudinary
        const oldPrimary = await CarImage.findOne({ where: { car_id: car.id, is_primary: true }, transaction });
        if (oldPrimary) {
          const oldPid = oldPrimary.public_id || extractPublicIdFromUrl(oldPrimary.image_url);
          if (oldPid) deleteCloudinaryMedia(oldPid).catch(() => {});
          await oldPrimary.destroy({ transaction });
        }
        const pUrl = getFileUrl(files.primary_image[0]);
        if (pUrl) {
          imageRecords.push({
            car_id: car.id,
            image_url: pUrl,
            public_id: getFilePublicId(files.primary_image[0], pUrl),
            is_primary: true,
          });
        }
      }

      const secondaryFiles = files.images || [];
      secondaryFiles.forEach((file) => {
        const sUrl = getFileUrl(file);
        if (sUrl) {
          imageRecords.push({
            car_id: car.id,
            image_url: sUrl,
            public_id: getFilePublicId(file, sUrl),
            is_primary: false,
          });
        }
      });

      if (imageRecords.length > 0) {
        await CarImage.bulkCreate(imageRecords, { transaction });
      }
    }

    const highlightIds = updateData.highlight_ids !== undefined ? (mapped.highlight_ids || updateData.highlight_ids) : mapped.highlight_ids;
    if (highlightIds !== undefined) {
      if (Array.isArray(highlightIds)) {
        if (highlightIds.length > 0) {
          const foundHighlights = await Highlight.findAll({
            where: { id: { [Op.in]: highlightIds } },
            attributes: ['id'],
            transaction,
          });
          if (foundHighlights.length !== highlightIds.length) {
            throw new AppError('One or more highlight IDs are invalid.', 400);
          }
        }
        await car.setHighlights(highlightIds, { transaction });
      }
    }

    await transaction.commit();

    // Trigger async background notification / requirement matching on qualified price drop
    if (hasPriceDropOccurred) {
      notificationQueue.add({ carId: car.id, event: 'price_drop' }).catch((err) => {
        console.warn('[Notification Queue] Error adding price drop job:', err.message);
      });
    }

    const updatedCar = await Car.findByPk(car.id, {
      include: [
        { model: CarImage, as: 'images' },
        sellerInclude,
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: Highlight, as: 'highlights', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
    });

    await invalidateCarCaches(updatedCar.id, updatedCar.user_id, car.user_id);

    return transformCarImages(updatedCar);
  } catch (error) {
    console.error('❌ UPDATE CAR SERVICE ERROR:', error);
    await transaction.rollback();
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new AppError('Foreign key constraint error: Brand, Model, Variant, or Location not found in database.', 400);
    }
    if (error.name === 'SequelizeValidationError') {
      throw new AppError(error.errors?.[0]?.message || 'Database validation error', 400);
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('Duplicate record detected for this car listing.', 400);
    }
    if (error.name === 'SequelizeDatabaseError') {
      if (/unknown column/i.test(error.message) || /column.*does not exist/i.test(error.message)) {
        throw new AppError(`Database schema out of sync: ${error.message}. Please run database migrations on server.`, 500);
      }
      throw new AppError(`Database error: ${error.message}`, 500);
    }
    throw new AppError(error.message || 'Failed to update car listing.', error.statusCode || 500);
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
    const publicId = image.public_id || extractPublicIdFromUrl(image.image_url);
    await image.destroy({ transaction });

    if (publicId) {
      deleteCloudinaryMedia(publicId).catch(() => {});
    }

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
  const { where, queryModel, sanitizedFilters } = await buildCarFiltersWhere(filters, {
    isUserScope: false,
    userRole: 'admin',
  });

  const parsedPage = sanitizedFilters.page ? parseInt(sanitizedFilters.page, 10) : page;
  const parsedLimit = sanitizedFilters.limit ? parseInt(sanitizedFilters.limit, 10) : limit;
  const validSortCols = ['created_at', 'price', 'year', 'km_driven', 'status'];
  const validSort = sanitizedFilters.sortBy && validSortCols.includes(sanitizedFilters.sortBy) ? sanitizedFilters.sortBy : sortBy;
  const validOrder = sanitizedFilters.sortOrder && ['ASC', 'DESC'].includes(sanitizedFilters.sortOrder.toUpperCase()) ? sanitizedFilters.sortOrder.toUpperCase() : sortOrder;
  const offset = (parsedPage - 1) * parsedLimit;

  const { count, rows } = await queryModel.findAndCountAll({
    distinct: true,
    col: 'id',
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
      { model: City, as: 'cities', attributes: ['id', 'name'] },
    ],
    limit: parsedLimit,
    offset,
    order: [[validSort, validOrder.toUpperCase()]],
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = rows.map((car) => transformCarImages(car, baseUrl));

  return {
    total: count,
    cars: transformedCars,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(count / parsedLimit),
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
  // Fetch the car to check owner
  const car = await Car.findByPk(carId, { attributes: ['id', 'user_id'] });
  if (!car) return;
  if (userId && car.user_id === userId) return; // ✅ Don't count seller's own views

  const analyticsService = require('./analyticsService');

  if (userId) {
    const existing = await View.findOne({
      where: { car_id: carId, user_id: userId },
    });
    if (!existing) {
      await View.create({ car_id: carId, user_id: userId, timestamp: new Date() });
      await analyticsService.recordInteraction({ carId, userId, type: 'view', ipAddress });
    } else {
      // Update the timestamp to reflect the latest view time without inflating records
      await existing.update({ timestamp: new Date() });
    }
  } else {
    // Guest view: record in View table with user_id: null and trigger aggregated interaction
    await View.create({ car_id: carId, user_id: null, timestamp: new Date() });
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
      'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'previous_price', 'has_price_drop', 'price_negotiable', 'km_driven',
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
        'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'previous_price', 'has_price_drop', 'price_negotiable',
        'km_driven', 'fuel_type', 'transmission', 'ownership', 'status',
        'created_at', 'brand_id', 'body_type',
        'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
      ],
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
        { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'], where: { is_primary: true }, required: false },
        { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
        { model: City, as: 'cities', attributes: ['id', 'name'] }
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
          'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'previous_price', 'has_price_drop', 'price_negotiable',
          'km_driven', 'fuel_type', 'transmission', 'ownership', 'status',
          'created_at', 'brand_id', 'body_type',
          'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
        ],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'], where: { is_primary: true }, required: false },
          { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
          { model: District, as: 'district', attributes: ['id', 'name'] },
          { model: City, as: 'city', attributes: ['id', 'name'] },
          { model: City, as: 'cities', attributes: ['id', 'name'] }
        ]
      });
      scoredCandidates = fallbackCars.map(car => ({ car, score: 0 }));
    }

    const total = scoredCandidates.length;
    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
    const paginatedCars = scoredCandidates.slice(offset, offset + limit).map(sc => transformCarImages(sc.car, baseUrl));

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
          'id', 'user_id', 'model_id', 'variant_id', 'year', 'price', 'previous_price', 'has_price_drop', 'price_negotiable',
          'km_driven', 'fuel_type', 'transmission', 'ownership', 'status',
          'created_at', 'brand_id', 'body_type',
          'b2b_listing', 'board_type', 'state_id', 'district_id', 'city_id'
        ],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'], where: { is_primary: true }, required: false },
          { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
          { model: District, as: 'district', attributes: ['id', 'name'] },
          { model: City, as: 'city', attributes: ['id', 'name'] },
          { model: City, as: 'cities', attributes: ['id', 'name'] }
        ]
      });

      // Order correctly based on the ids
      const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
      recommendedCarsData = recommendedCarIds
        .map(id => recCars.find(c => c.id === id))
        .filter(Boolean)
        .map(c => transformCarImages(c, baseUrl));
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

exports.uploadCarVideo = async (carId, userId, file) => {
  const { Car } = require('../models');
  const { AppError } = require('../utils/errorHandler');
  const { cloudinary } = require('../config/cloudinary');
  const fs = require('fs');

  if (!file) throw new AppError('No video file provided', 400);

  const car = await Car.findOne({ where: { id: carId, user_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized', 404);

  // If multer already streamed to Cloudinary, file.path or file.secure_url is the Cloudinary URL
  let videoUrl = file.path || file.secure_url;

  if (videoUrl && (videoUrl.startsWith('https://res.cloudinary.com/') || videoUrl.startsWith('http://res.cloudinary.com/'))) {
    videoUrl = videoUrl.replace('http://', 'https://');
  } else if (file.path && fs.existsSync(file.path)) {
    // If a temporary local file was uploaded, stream to Cloudinary
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'video',
        folder: `autodeal4u/cars/${carId}/videos`,
        public_id: `video-${Date.now()}`,
      });
      videoUrl = result.secure_url;
      try { fs.unlinkSync(file.path); } catch (e) {}
    } catch (uploadErr) {
      try { fs.unlinkSync(file.path); } catch (e) {}
      throw new AppError(uploadErr.message || 'Failed to upload video to Cloudinary', 500);
    }
  }

  if (!videoUrl || !videoUrl.startsWith('https://res.cloudinary.com/')) {
    throw new AppError('Video upload failed: No valid Cloudinary URL returned.', 500);
  }

  car.video_url = videoUrl;
  await car.save();
  await invalidateCarCaches(car.id, userId);

  return videoUrl;
};

exports.invalidateCarCaches = invalidateCarCaches;
