const {
  Bike,
  BikeImage,
  User,
  DealerProfile,
  CarType,
  Brand,
  Model,
  State,
  District,
  City,
  Wishlist,
  Lead,
  View,
  Category,
  BrandType,
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const notificationQueue = require('../queues/notificationQueue');
const { cloudinary } = require('../config/cloudinary');
const { generateUniqueSlug } = require('../utils/slugify');
const {
  extractPublicIdFromUrl,
  getOptimizedCloudinaryUrl,
  deleteCloudinaryMedia,
} = require('../utils/cloudinaryHelper');
const {
  mapToBikeDbValues,
  SORT_BY_WHITELIST,
} = require('../validations/bikeValidation');
const { MAX_BIKE_IMAGES } = require('../middlewares/upload');

const clearCache = async (key) => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.error('Redis clear cache error in bikeService:', err);
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
    console.error(`Redis clear pattern error for ${pattern}:`, err);
  }
};

const invalidateBikeCaches = async (bikeId = null, userId = null) => {
  try {
    if (bikeId) {
      await clearCache(`bike:${bikeId}`);
    }
    await clearCachePattern('bike:*');
    await clearCachePattern('bikes:*');
    await clearCachePattern('seller:*');
    await clearCachePattern('similar:bike:*');
    await clearCachePattern('recommended:bike:*');
    await clearCachePattern('dealer:*');
    await clearCachePattern('global_search:*');

    const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
    await clearHttpCache('/api/v1/bikes');
    await clearHttpCache('/api/bikes');
    await clearHttpCache('/api/v1/search');

    if (userId) {
      const dashboardService = require('./dashboardService');
      await dashboardService.invalidateDashboardCache(userId);
    }
  } catch (err) {
    console.error('Bike cache invalidation error:', err);
  }
};

const isUuid = (val) => {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
};

const sellerInclude = {
  model: User,
  as: 'seller',
  attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
  include: [
    { model: District, as: 'district', attributes: ['name'] },
    { model: DealerProfile, as: 'dealerProfile', attributes: ['company_name'] },
  ],
};

const bikeIncludeList = [
  { model: Brand, as: 'brand', attributes: ['id', 'name', 'slug', 'logo'] },
  { model: Model, as: 'bikeModel', attributes: ['id', 'name', 'body_type'] },
  { model: CarType, as: 'vehicleType', attributes: ['id', 'name', 'slug'] },
  { model: State, as: 'state', attributes: ['id', 'name'] },
  { model: District, as: 'district', attributes: ['id', 'name'] },
  { model: City, as: 'city', attributes: ['id', 'name'] },
  {
    model: BikeImage,
    as: 'images',
    attributes: ['id', 'image_url', 'public_id', 'is_primary', 'sort_order'],
    required: false,
  },
  sellerInclude,
];

const maskPhone = (phone) => {
  if (!phone) return null;
  const str = String(phone).trim();
  if (str.length <= 4) return '******';
  return '*'.repeat(str.length - 4) + str.slice(-4);
};

const maskEmail = (email) => {
  if (!email) return null;
  const str = String(email).trim();
  const parts = str.split('@');
  if (parts.length < 2) return '******';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? '*'.repeat(name.length) : name[0] + '*'.repeat(Math.max(name.length - 2, 1)) + name[name.length - 1];
  return `${maskedName}@${domain}`;
};

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

/**
 * Formats Bike entity into standardized API response object
 */
const transformBike = (bike, viewerUser = null) => {
  if (!bike) return null;
  const rawImages = bike.images || [];

  const validImages = [];
  for (const img of rawImages) {
    const item = typeof img.toJSON === 'function' ? img.toJSON() : { ...img };
    const rawUrl = item.image_url;
    if (!rawUrl || typeof rawUrl !== 'string') continue;
    if (rawUrl.match(/^[a-zA-Z]:[/\\]/) || rawUrl.includes('/uploads/') || rawUrl.includes('uploads\\')) {
      continue;
    }
    const optimized = getOptimizedCloudinaryUrl(rawUrl, { width: 800 }) || rawUrl;
    validImages.push({
      id: item.id,
      image_url: optimized,
      is_primary: Boolean(item.is_primary),
      public_id: item.public_id || extractPublicIdFromUrl(optimized),
      sort_order: item.sort_order || 0,
    });
  }

  validImages.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const primaryItem = validImages.find((img) => img.is_primary) || validImages[0] || null;
  const secondaryImages = validImages.filter((img) => img !== primaryItem).map((img) => img.image_url);

  const bJson = typeof bike.toJSON === 'function' ? bike.toJSON() : { ...bike };

  let sellerCompanyName = null;
  if (bJson.seller) {
    const rawSeller = bike.seller;
    const sellerDistrictName =
      rawSeller?.district?.name ||
      bJson.seller.district?.name ||
      (typeof bJson.seller.district === 'string' ? bJson.seller.district : null);
    sellerCompanyName =
      rawSeller?.dealerProfile?.company_name ||
      bJson.seller.dealerProfile?.company_name ||
      bJson.seller.company_name ||
      null;

    const isAuthorized = viewerUser && (viewerUser.id === bJson.user_id || viewerUser.role === 'admin');
    bJson.seller = {
      ...bJson.seller,
      phone: isAuthorized ? bJson.seller.phone : maskPhone(bJson.seller.phone),
      email: isAuthorized ? bJson.seller.email : maskEmail(bJson.seller.email),
      district: sellerDistrictName,
      company_name: sellerCompanyName,
    };
    delete bJson.seller.dealerProfile;
  }

  let stateObj = bJson.state || null;
  let districtObj = bJson.district || null;
  let cityObj = bJson.city || null;
  if (typeof stateObj === 'string') stateObj = { name: stateObj };
  if (typeof districtObj === 'string') districtObj = { name: districtObj };
  if (typeof cityObj === 'string') cityObj = { name: cityObj };

  const districtName = districtObj?.name || null;
  const cityName = cityObj?.name || null;
  const stateName = stateObj?.name || null;
  const locationText = [cityName, districtName, stateName].filter(Boolean).join(', ') || null;

  const brandName = bJson.brand?.name || null;
  const modelName = bJson.bikeModel?.name || null;
  const vehicleTypeName = bJson.vehicleType?.name || null;
  const displayTitle = bJson.title || [brandName, modelName, bJson.year].filter(Boolean).join(' ') || 'Bike';

  const formatMediaUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.match(/^[a-zA-Z]:[/\\]/) || url.includes('/uploads/') || url.includes('uploads\\')) return null;
    if (url.startsWith('https://res.cloudinary.com/')) return url;
    if (url.startsWith('http://res.cloudinary.com/')) return url.replace('http://', 'https://');
    return null;
  };

  const formatExpiryDate = (d) => {
    if (!d) return null;
    if (typeof d === 'string') return d.slice(0, 10);
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return d;
  };

  const price = bJson.price !== null && bJson.price !== undefined ? Number(bJson.price) : null;
  const is_expired = bJson.created_at && (Date.now() - new Date(bJson.created_at).getTime()) > 90 * 24 * 60 * 60 * 1000;

  return {
    ...bJson,
    target_type: 'bike',
    title: displayTitle,
    model: bJson.bikeModel || null,
    brand_name: brandName,
    model_name: modelName,
    vehicle_type: vehicleTypeName,
    price,
    price_negotiable: Boolean(bJson.price_negotiable),
    b2b_listing: Boolean(bJson.b2b_listing),
    b2b: Boolean(bJson.b2b_listing),
    prior_appointments: Boolean(bJson.prior_appointments),
    video_url: formatMediaUrl(bJson.video_url),
    audio_url: formatMediaUrl(bJson.audio_url),
    insurance_type: bJson.insurance_type || 'Not Insured',
    insurance_expiry_date: formatExpiryDate(bJson.insurance_expiry_date),
    state: stateObj,
    district: districtObj,
    city: cityObj,
    stateDetail: stateObj,
    districtDetail: districtObj,
    cityDetail: cityObj,
    state_name: stateName,
    district_name: districtName,
    city_name: cityName,
    location_text: locationText,
    dealerProfile: sellerCompanyName ? { company_name: sellerCompanyName } : null,
    primary_image: primaryItem ? primaryItem.image_url : null,
    secondary_images: secondaryImages,
    images: validImages,
    is_expired,
  };
};

exports.transformBike = transformBike;

/**
 * Attaches wishlist & leads metrics to bike listings
 */
const enrichBikesMetadata = async (bikes, viewerUserId = null) => {
  if (!Array.isArray(bikes) || bikes.length === 0) return bikes;
  const bikeIds = bikes.map((b) => b.id).filter(Boolean);
  if (bikeIds.length === 0) return bikes;

  const [wishlistCounts, userWishlists, leadCounts] = await Promise.all([
    Wishlist.findAll({
      attributes: ['target_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
      where: { target_type: 'bike', target_id: bikeIds },
      group: ['target_id'],
      raw: true,
    }),
    viewerUserId
      ? Wishlist.findAll({
          attributes: ['target_id'],
          where: { user_id: viewerUserId, target_type: 'bike', target_id: bikeIds },
          raw: true,
        })
      : Promise.resolve([]),
    Lead.findAll({
      attributes: ['target_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
      where: { target_type: 'bike', target_id: bikeIds },
      group: ['target_id'],
      raw: true,
    }),
  ]);

  const wishlistCountMap = {};
  wishlistCounts.forEach((r) => { wishlistCountMap[r.target_id] = parseInt(r.count, 10) || 0; });
  const userWishlistSet = new Set(userWishlists.map((w) => w.target_id));
  const leadCountMap = {};
  leadCounts.forEach((r) => { leadCountMap[r.target_id] = parseInt(r.count, 10) || 0; });

  return bikes.map((b) => {
    const isWishlisted = viewerUserId ? userWishlistSet.has(b.id) : false;
    return {
      ...b,
      is_wishlisted: isWishlisted,
      isWishlist: isWishlisted,
      wishlist_count: wishlistCountMap[b.id] || 0,
      leads_count: leadCountMap[b.id] || 0,
    };
  });
};

/**
 * Create a Bike Listing (up to 12 photos)
 */
exports.createBike = async (userId, userRole, rawData, files) => {
  const transaction = await sequelize.transaction();
  const createdUploads = [];

  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found', 404);

    const mapped = mapToBikeDbValues(rawData);

    // 1. Resolve Brand
    const brandInput = mapped.brand_id || mapped.brand;
    if (!brandInput) throw new AppError('brand_id or brand is required', 400);

    let brand = null;
    if (isUuid(brandInput)) {
      brand = await Brand.findByPk(brandInput, { transaction });
    } else {
      brand = await Brand.findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), String(brandInput).trim().toLowerCase()),
        transaction,
      });
    }
    if (!brand) throw new AppError(`Invalid brand: ${brandInput}`, 400);

    // 2. Resolve Model
    const modelInput = mapped.model_id || mapped.model;
    if (!modelInput) throw new AppError('model_id or model is required', 400);

    let bikeModel = null;
    if (isUuid(modelInput)) {
      bikeModel = await Model.findOne({ where: { id: modelInput, brandId: brand.id }, transaction });
      if (!bikeModel) {
        bikeModel = await Model.findByPk(modelInput, { transaction });
      }
    } else {
      bikeModel = await Model.findOne({
        where: {
          brandId: brand.id,
          [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), String(modelInput).trim().toLowerCase())],
        },
        transaction,
      });
    }
    if (!bikeModel) throw new AppError(`Invalid model for brand ${brand.name}: ${modelInput}`, 400);

    // 3. Optional Vehicle Type resolution
    let vehicleTypeId = mapped.vehicle_type_id || null;
    if (vehicleTypeId && !isUuid(vehicleTypeId)) {
      const vt = await CarType.findOne({
        where: {
          [Op.or]: [
            { slug: String(vehicleTypeId).toLowerCase().trim() },
            { name: String(vehicleTypeId).trim() },
          ],
        },
        transaction,
      });
      vehicleTypeId = vt ? vt.id : null;
    } else if (!vehicleTypeId) {
      const bikeCat = await Category.findOne({ where: { slug: 'bike' }, transaction });
      if (bikeCat) {
        const defaultType = await CarType.findOne({
          where: {
            category_id: bikeCat.id,
            ...(bikeModel.body_type ? { name: { [Op.like]: `%${bikeModel.body_type}%` } } : {}),
          },
          transaction,
        }) || await CarType.findOne({ where: { category_id: bikeCat.id }, order: [['order', 'ASC']], transaction });
        if (defaultType) vehicleTypeId = defaultType.id;
      }
    }

    // 4. Location Hierarchy Resolution
    let stateId = mapped.state_id || user.state_id || null;
    let districtId = mapped.district_id || user.district_id || null;
    let cityId = mapped.city_id || user.city_id || null;

    if (cityId) {
      const city = await City.findByPk(cityId, { transaction });
      if (city) {
        if (!districtId && city.district_id) districtId = city.district_id;
        if (!stateId && city.state_id) stateId = city.state_id;
      } else {
        cityId = null;
      }
    }

    if (districtId) {
      const district = await District.findByPk(districtId, { transaction });
      if (district) {
        if (!stateId && district.state_id) stateId = district.state_id;
        if (!cityId) {
          const city = await City.findOne({ where: { district_id: districtId }, transaction });
          if (city) cityId = city.id;
        }
      } else {
        districtId = null;
      }
    }

    if (stateId) {
      const stateExists = await State.findByPk(stateId, { transaction });
      if (!stateExists) stateId = null;
    }

    // 5. Slug & Defaults
    const posted_by_type = userRole === 'dealer' ? 'dealer' : 'customer';
    const b2b_listing = Boolean(mapped.b2b_listing);
    const prior_appointments = Boolean(mapped.prior_appointments);
    const title = mapped.title || `${brand.name} ${bikeModel.name} (${mapped.year})`;
    const baseSlugName = `${brand.name}-${bikeModel.name}-${mapped.year}`;
    const slug = await generateUniqueSlug(Bike, baseSlugName, null, { transaction });

    let videoUrl = null;
    let audioUrl = null;
    if (files?.video?.[0]) {
      videoUrl = getFileUrl(files.video[0]);
      const vidPid = getFilePublicId(files.video[0], videoUrl);
      if (vidPid) createdUploads.push(vidPid);
    } else if (rawData.video_url) {
      videoUrl = getFileUrl(rawData.video_url);
    }

    if (files?.audio?.[0]) {
      audioUrl = getFileUrl(files.audio[0]);
      const audPid = getFilePublicId(files.audio[0], audioUrl);
      if (audPid) createdUploads.push(audPid);
    } else if (rawData.audio_url) {
      audioUrl = getFileUrl(rawData.audio_url);
    }

    // 6. Create Bike record
    const bike = await Bike.create({
      user_id: userId,
      vehicle_type_id: vehicleTypeId,
      brand_id: brand.id,
      model_id: bikeModel.id,
      title,
      year: mapped.year,
      fuel_type: mapped.fuel_type,
      ownership: mapped.ownership || '1st Owner',
      km_driven: mapped.km_driven,
      price: mapped.price,
      price_negotiable: mapped.price_negotiable || false,
      b2b_listing,
      prior_appointments,
      insurance_type: mapped.insurance_type || 'Not Insured',
      insurance_expiry_date: mapped.insurance_expiry_date || null,
      video_url: videoUrl,
      audio_url: audioUrl,
      description: mapped.description || null,
      state_id: stateId,
      district_id: districtId,
      city_id: cityId,
      posted_by_type,
      status: 'active',
      slug,
      views_count: 0,
      is_featured: false,
    }, { transaction });

    // 7. Process up to 12 photos
    const imageRecords = [];
    let primaryUrl = null;
    let primaryPublicId = null;

    if (files?.primary_image?.[0]) {
      primaryUrl = getFileUrl(files.primary_image[0]);
      primaryPublicId = getFilePublicId(files.primary_image[0], primaryUrl);
    } else if (rawData.primary_image && typeof rawData.primary_image === 'string') {
      primaryUrl = getFileUrl(rawData.primary_image);
      primaryPublicId = extractPublicIdFromUrl(primaryUrl);
    } else if (files?.secondary_images?.[0]) {
      primaryUrl = getFileUrl(files.secondary_images[0]);
      primaryPublicId = getFilePublicId(files.secondary_images[0], primaryUrl);
    } else if (files?.images?.[0]) {
      primaryUrl = getFileUrl(files.images[0]);
      primaryPublicId = getFilePublicId(files.images[0], primaryUrl);
    } else if (Array.isArray(rawData.images) && rawData.images[0]) {
      primaryUrl = getFileUrl(rawData.images[0]);
      primaryPublicId = extractPublicIdFromUrl(primaryUrl);
    } else if (Array.isArray(rawData.secondary_images) && rawData.secondary_images[0]) {
      primaryUrl = getFileUrl(rawData.secondary_images[0]);
      primaryPublicId = extractPublicIdFromUrl(primaryUrl);
    }

    if (!primaryUrl) {
      throw new AppError('Primary image is required. Provide at least one valid image.', 400);
    }

    if (primaryPublicId) createdUploads.push(primaryPublicId);
    imageRecords.push({
      bike_id: bike.id,
      image_url: primaryUrl,
      public_id: primaryPublicId,
      is_primary: true,
      sort_order: 0,
    });

    const secondaryInputs = [];
    if (files?.secondary_images) {
      files.secondary_images.forEach((f) => {
        const u = getFileUrl(f);
        if (u && u !== primaryUrl) secondaryInputs.push({ url: u, public_id: getFilePublicId(f, u) });
      });
    }
    if (files?.images) {
      files.images.forEach((f) => {
        const u = getFileUrl(f);
        if (u && u !== primaryUrl) secondaryInputs.push({ url: u, public_id: getFilePublicId(f, u) });
      });
    }
    const rawSec = [].concat(rawData.secondary_images || [], rawData.images || []);
    rawSec.forEach((u) => {
      if (typeof u === 'string' && u.trim() !== '') {
        const cleanU = getFileUrl(u);
        if (cleanU && cleanU !== primaryUrl) secondaryInputs.push({ url: cleanU, public_id: extractPublicIdFromUrl(cleanU) });
      }
    });

    const uniqueSecondary = [];
    const seenUrls = new Set([primaryUrl]);
    for (const s of secondaryInputs) {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        uniqueSecondary.push(s);
      }
    }

    if (1 + uniqueSecondary.length > MAX_BIKE_IMAGES) {
      throw new AppError(`Maximum ${MAX_BIKE_IMAGES} images allowed per bike listing.`, 400);
    }

    uniqueSecondary.forEach((s, idx) => {
      if (s.public_id) createdUploads.push(s.public_id);
      imageRecords.push({
        bike_id: bike.id,
        image_url: s.url,
        public_id: s.public_id,
        is_primary: false,
        sort_order: idx + 1,
      });
    });

    await BikeImage.bulkCreate(imageRecords, { transaction });
    await transaction.commit();

    // Queue requirement matching alert asynchronously
    try {
      const requirementService = require('./requirementService');
      if (typeof requirementService.checkBikeRequirementMatches === 'function') {
        requirementService.checkBikeRequirementMatches(bike).catch(() => {});
      }
    } catch (e) {}

    await invalidateBikeCaches(bike.id, userId);

    const createdBike = await Bike.findByPk(bike.id, { include: bikeIncludeList });
    const formatted = transformBike(createdBike, user);
    return {
      ...formatted,
      is_wishlisted: false,
      isWishlist: false,
      wishlist_count: 0,
      leads_count: 0,
    };
  } catch (error) {
    await transaction.rollback();
    for (const pid of createdUploads) {
      try {
        await deleteCloudinaryMedia(pid);
      } catch (cleanupErr) {}
    }
    throw error;
  }
};

/**
 * Get Bikes List with Filters, Facets & Pagination
 */
exports.getBikes = async (filters = {}, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC', viewerUserId = null, viewerRole = null) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  const statusFilter = filters.status ? String(filters.status).toLowerCase() : 'active';
  if (statusFilter !== 'all') {
    where.status = statusFilter;
  } else {
    where.status = { [Op.ne]: 'deleted' };
  }

  // Filter by Brand
  const rawBrand = filters.brand_id || filters.brand || filters.brands;
  if (rawBrand) {
    const vals = (Array.isArray(rawBrand) ? rawBrand : String(rawBrand).split(',')).map((s) => s.trim()).filter(Boolean);
    const uuidVals = vals.filter(isUuid);
    const nameVals = vals.filter((v) => !isUuid(v));
    const brandIds = [...uuidVals];
    if (nameVals.length > 0) {
      const matchedBrands = await Brand.findAll({
        where: { name: { [Op.in]: nameVals } },
        attributes: ['id'],
        raw: true,
      });
      matchedBrands.forEach((b) => brandIds.push(b.id));
    }
    if (brandIds.length > 0) {
      where.brand_id = brandIds.length === 1 ? brandIds[0] : { [Op.in]: brandIds };
    } else if (vals.length > 0) {
      where.brand_id = null;
    }
  }

  // Filter by Model
  const rawModel = filters.model_id || filters.model || filters.models;
  if (rawModel) {
    const vals = (Array.isArray(rawModel) ? rawModel : String(rawModel).split(',')).map((s) => s.trim()).filter(Boolean);
    const uuidVals = vals.filter(isUuid);
    const nameVals = vals.filter((v) => !isUuid(v));
    const modelIds = [...uuidVals];
    if (nameVals.length > 0) {
      const matchedModels = await Model.findAll({
        where: { name: { [Op.in]: nameVals } },
        attributes: ['id'],
        raw: true,
      });
      matchedModels.forEach((m) => modelIds.push(m.id));
    }
    if (modelIds.length > 0) {
      where.model_id = modelIds.length === 1 ? modelIds[0] : { [Op.in]: modelIds };
    } else if (vals.length > 0) {
      where.model_id = null;
    }
  }

  // Filter by Vehicle Type
  if (filters.vehicle_type_id || filters.vehicle_type || filters.vehicleType) {
    const rawVt = String(filters.vehicle_type_id || filters.vehicle_type || filters.vehicleType).trim();
    if (isUuid(rawVt)) {
      where.vehicle_type_id = rawVt;
    } else {
      const vt = await CarType.findOne({ where: { [Op.or]: [{ slug: rawVt.toLowerCase() }, { name: rawVt }] }, attributes: ['id'] });
      where.vehicle_type_id = vt ? vt.id : null;
    }
  }

  // Fuel Type
  const rawFuel = filters.fuel_type || filters.fuel_types || filters.fueltype;
  if (rawFuel) {
    const fuels = (Array.isArray(rawFuel) ? rawFuel : String(rawFuel).split(','))
      .map((f) => mapToBikeDbValues({ fuel_type: f }).fuel_type)
      .filter(Boolean);
    if (fuels.length > 0) {
      where.fuel_type = fuels.length === 1 ? fuels[0] : { [Op.in]: fuels };
    }
  }

  // Ownership
  const rawOwn = filters.ownership || filters.ownerships;
  if (rawOwn) {
    const owns = (Array.isArray(rawOwn) ? rawOwn : String(rawOwn).split(','))
      .map((o) => mapToBikeDbValues({ ownership: o }).ownership)
      .filter(Boolean);
    if (owns.length > 0) {
      where.ownership = owns.length === 1 ? owns[0] : { [Op.in]: owns };
    }
  }

  // Price range
  const minP = filters.min_price ?? filters.minPrice;
  const maxP = filters.max_price ?? filters.maxPrice;
  if (minP !== undefined || maxP !== undefined) {
    where.price = {};
    if (minP !== undefined && minP !== '') where.price[Op.gte] = Number(minP);
    if (maxP !== undefined && maxP !== '') where.price[Op.lte] = Number(maxP);
  } else if (filters.price !== undefined && filters.price !== '') {
    where.price = { [Op.lte]: Number(filters.price) };
  }

  // Year range
  const minY = filters.min_year ?? filters.minYear;
  const maxY = filters.max_year ?? filters.maxYear;
  if (minY !== undefined || maxY !== undefined) {
    where.year = {};
    if (minY !== undefined && minY !== '') where.year[Op.gte] = parseInt(minY, 10);
    if (maxY !== undefined && maxY !== '') where.year[Op.lte] = parseInt(maxY, 10);
  } else if (filters.year !== undefined && filters.year !== '') {
    where.year = parseInt(filters.year, 10);
  }

  // KM range
  const minK = filters.min_km ?? filters.minKm;
  const maxK = filters.max_km ?? filters.maxKm;
  if (minK !== undefined || maxK !== undefined) {
    where.km_driven = {};
    if (minK !== undefined && minK !== '') where.km_driven[Op.gte] = parseInt(minK, 10);
    if (maxK !== undefined && maxK !== '') where.km_driven[Op.lte] = parseInt(maxK, 10);
  } else if (filters.km_driven !== undefined && filters.km_driven !== '') {
    where.km_driven = { [Op.lte]: parseInt(filters.km_driven, 10) };
  }

  // Location filters
  if (filters.state_id && isUuid(String(filters.state_id).trim())) {
    where.state_id = String(filters.state_id).trim();
  } else if (filters.state) {
    const s = await State.findOne({ where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), String(filters.state).trim().toLowerCase()) });
    if (s) where.state_id = s.id;
  }

  if (filters.district_id && isUuid(String(filters.district_id).trim())) {
    where.district_id = String(filters.district_id).trim();
  } else if (filters.district) {
    const d = await District.findOne({ where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), String(filters.district).trim().toLowerCase()) });
    if (d) where.district_id = d.id;
  }

  if (filters.city_id && isUuid(String(filters.city_id).trim())) {
    where.city_id = String(filters.city_id).trim();
  } else if (filters.city) {
    const c = await City.findOne({ where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), String(filters.city).trim().toLowerCase()) });
    if (c) where.city_id = c.id;
  }

  // Seller / User / Dealer filtering
  const rawSeller = filters.user_id || filters.seller_id || filters.dealer_id || filters.dealerId;
  if (rawSeller) {
    where.user_id = rawSeller === 'me' ? viewerUserId : rawSeller;
  }

  if (filters.posted_by_type && filters.posted_by_type !== 'all') {
    where.posted_by_type = filters.posted_by_type;
  }

  const rawB2b = filters.b2b_listing ?? filters.b2b ?? filters.b2bListing;
  if (rawB2b !== undefined && rawB2b !== '') {
    where.b2b_listing = rawB2b === true || rawB2b === 'true' || rawB2b === 1 || rawB2b === '1';
  }

  // Search query
  const q = filters.q || filters.search;
  if (q && String(q).trim() !== '') {
    const likeTerm = `%${String(q).trim()}%`;
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { title: { [Op.like]: likeTerm } },
        { description: { [Op.like]: likeTerm } },
        { '$brand.name$': { [Op.like]: likeTerm } },
        { '$bikeModel.name$': { [Op.like]: likeTerm } },
        { '$city.name$': { [Op.like]: likeTerm } },
        { '$district.name$': { [Op.like]: likeTerm } },
      ],
    });
  }

  const safeSortBy = SORT_BY_WHITELIST.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { count, rows } = await Bike.findAndCountAll({
    where,
    include: bikeIncludeList,
    subQuery: false,
    distinct: true,
    col: 'id',
    order: [[safeSortBy, safeSortOrder]],
    limit: limitNum,
    offset,
  });

  const viewerUser = viewerUserId ? { id: viewerUserId, role: viewerRole } : null;
  const formatted = rows.map((r) => transformBike(r, viewerUser));
  const bikes = await enrichBikesMetadata(formatted, viewerUserId);

  return {
    bikes,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  };
};

/**
 * Get Single Bike by ID or Slug
 */
exports.getBikeById = async (idOrSlug, viewerUser = null) => {
  const where = isUuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
  const bike = await Bike.findOne({
    where,
    include: bikeIncludeList,
  });
  if (!bike) throw new AppError('Bike listing not found', 404);

  const formatted = transformBike(bike, viewerUser);
  const enriched = await enrichBikesMetadata([formatted], viewerUser?.id || null);
  return enriched[0];
};

/**
 * Get Seller's Own Bikes
 */
exports.getSellerBikes = async (sellerId, query = {}, viewerUser = null) => {
  const pageNum = Math.max(parseInt(query.page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (pageNum - 1) * limitNum;

  const where = { user_id: sellerId };
  if (query.status && query.status !== 'all') {
    where.status = String(query.status).toLowerCase();
  } else {
    where.status = { [Op.ne]: 'deleted' };
  }

  const { count, rows } = await Bike.unscoped().findAndCountAll({
    where,
    include: bikeIncludeList,
    distinct: true,
    col: 'id',
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  const formatted = rows.map((r) => transformBike(r, viewerUser || { id: sellerId }));
  const bikes = await enrichBikesMetadata(formatted, viewerUser?.id || sellerId);

  return {
    bikes,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  };
};

/**
 * Update Bike Listing
 */
exports.updateBike = async (bikeId, userId, userRole, rawData, files) => {
  const bike = await Bike.findByPk(bikeId, { include: [{ model: BikeImage, as: 'images' }] });
  if (!bike) throw new AppError('Bike listing not found', 404);

  if (bike.user_id !== userId && userRole !== 'admin') {
    throw new AppError('You are not authorized to update this bike listing', 403);
  }

  const mapped = mapToBikeDbValues(rawData);
  const transaction = await sequelize.transaction();

  try {
    const updatePayload = {};
    const editableFields = [
      'title', 'year', 'fuel_type', 'ownership', 'km_driven', 'price',
      'price_negotiable', 'b2b_listing', 'prior_appointments', 'insurance_type',
      'insurance_expiry_date', 'description', 'status', 'state_id', 'district_id', 'city_id',
    ];
    editableFields.forEach((f) => {
      if (mapped[f] !== undefined) updatePayload[f] = mapped[f];
    });

    if (mapped.brand_id && isUuid(mapped.brand_id)) updatePayload.brand_id = mapped.brand_id;
    if (mapped.model_id && isUuid(mapped.model_id)) updatePayload.model_id = mapped.model_id;

    if (files?.video?.[0]) {
      updatePayload.video_url = getFileUrl(files.video[0]);
    } else if (mapped.remove_video === true || mapped.remove_video === 'true') {
      updatePayload.video_url = null;
    } else if (rawData.video_url !== undefined) {
      updatePayload.video_url = rawData.video_url ? getFileUrl(rawData.video_url) : null;
    }

    if (files?.audio?.[0]) {
      updatePayload.audio_url = getFileUrl(files.audio[0]);
    } else if (mapped.remove_audio === true || mapped.remove_audio === 'true') {
      updatePayload.audio_url = null;
    } else if (rawData.audio_url !== undefined) {
      updatePayload.audio_url = rawData.audio_url ? getFileUrl(rawData.audio_url) : null;
    }

    await bike.update(updatePayload, { transaction });

    // Optional image replacement or additions
    const newImages = [];
    if (files?.primary_image?.[0]) {
      const u = getFileUrl(files.primary_image[0]);
      if (u) newImages.push({ url: u, pid: getFilePublicId(files.primary_image[0], u), isPrimary: true });
    }
    const secFiles = [].concat(files?.secondary_images || [], files?.images || []);
    secFiles.forEach((f) => {
      const u = getFileUrl(f);
      if (u) newImages.push({ url: u, pid: getFilePublicId(f, u), isPrimary: false });
    });

    if (newImages.length > 0) {
      const currentCount = bike.images?.length || 0;
      const replaceImages = rawData.replace_images === true || rawData.replace_images === 'true';

      if (replaceImages) {
        await BikeImage.destroy({ where: { bike_id: bike.id }, transaction });
        if (newImages.length > MAX_BIKE_IMAGES) {
          throw new AppError(`Maximum ${MAX_BIKE_IMAGES} images allowed per bike.`, 400);
        }
        const recs = newImages.map((img, i) => ({
          bike_id: bike.id,
          image_url: img.url,
          public_id: img.pid,
          is_primary: i === 0 || img.isPrimary,
          sort_order: i,
        }));
        await BikeImage.bulkCreate(recs, { transaction });
      } else {
        if (currentCount + newImages.length > MAX_BIKE_IMAGES) {
          throw new AppError(`Total images cannot exceed ${MAX_BIKE_IMAGES}.`, 400);
        }
        const recs = newImages.map((img, i) => ({
          bike_id: bike.id,
          image_url: img.url,
          public_id: img.pid,
          is_primary: currentCount === 0 && i === 0,
          sort_order: currentCount + i,
        }));
        await BikeImage.bulkCreate(recs, { transaction });
      }
    }

    await transaction.commit();
    await invalidateBikeCaches(bike.id, bike.user_id);

    return await exports.getBikeById(bike.id, { id: userId, role: userRole });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.markAsSold = async (bikeId, userId, userRole) => {
  const bike = await Bike.findByPk(bikeId);
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized to mark this bike as sold', 403);
  }
  await bike.update({ status: 'sold' });
  await invalidateBikeCaches(bike.id, bike.user_id);
  return await exports.getBikeById(bike.id, { id: userId, role: userRole });
};

exports.deleteBike = async (bikeId, userId, userRole) => {
  const bike = await Bike.findByPk(bikeId);
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized to delete this bike listing', 403);
  }
  await bike.update({ status: 'deleted' });
  await bike.destroy(); // paranoid soft-delete
  await invalidateBikeCaches(bike.id, bike.user_id);
  return { success: true, message: 'Bike listing deleted successfully.' };
};

/**
 * Image Management
 */
exports.addImages = async (bikeId, userId, userRole, files, body) => {
  const bike = await Bike.findByPk(bikeId, { include: [{ model: BikeImage, as: 'images' }] });
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized to modify bike images', 403);
  }

  const incoming = [];
  const fileList = [].concat(files?.primary_image || [], files?.secondary_images || [], files?.images || []);
  fileList.forEach((f) => {
    const u = getFileUrl(f);
    if (u) incoming.push({ url: u, pid: getFilePublicId(f, u) });
  });
  const bodyUrls = [].concat(body?.images || [], body?.secondary_images || []);
  bodyUrls.forEach((u) => {
    if (typeof u === 'string' && u.trim() !== '') {
      const cleanU = getFileUrl(u);
      if (cleanU) incoming.push({ url: cleanU, pid: extractPublicIdFromUrl(cleanU) });
    }
  });

  if (incoming.length === 0) {
    throw new AppError('No valid images provided.', 400);
  }

  const existingCount = bike.images?.length || 0;
  if (existingCount + incoming.length > MAX_BIKE_IMAGES) {
    throw new AppError(`Maximum ${MAX_BIKE_IMAGES} images allowed per bike. Currently have ${existingCount}.`, 400);
  }

  const hasPrimary = bike.images?.some((img) => img.is_primary);
  const created = await BikeImage.bulkCreate(
    incoming.map((item, idx) => ({
      bike_id: bike.id,
      image_url: item.url,
      public_id: item.pid,
      is_primary: !hasPrimary && idx === 0,
      sort_order: existingCount + idx,
    }))
  );

  await invalidateBikeCaches(bike.id, bike.user_id);
  return created;
};

exports.deleteImage = async (bikeId, imageId, userId, userRole) => {
  const bike = await Bike.findByPk(bikeId, { include: [{ model: BikeImage, as: 'images' }] });
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized to delete bike image', 403);
  }

  const target = bike.images?.find((img) => img.id === imageId);
  if (!target) throw new AppError('Image not found on this bike listing', 404);
  if ((bike.images?.length || 0) <= 1) {
    throw new AppError('Cannot delete the only remaining image on a listing.', 400);
  }

  const wasPrimary = target.is_primary;
  if (target.public_id) {
    try { await deleteCloudinaryMedia(target.public_id); } catch (e) {}
  }
  await target.destroy();

  if (wasPrimary) {
    const nextImg = await BikeImage.findOne({ where: { bike_id: bike.id }, order: [['sort_order', 'ASC']] });
    if (nextImg) await nextImg.update({ is_primary: true });
  }

  await invalidateBikeCaches(bike.id, bike.user_id);
  return { success: true, message: 'Image deleted.' };
};

exports.setPrimaryImage = async (bikeId, imageId, userId, userRole) => {
  const bike = await Bike.findByPk(bikeId, { include: [{ model: BikeImage, as: 'images' }] });
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized to modify primary image', 403);
  }

  const target = bike.images?.find((img) => img.id === imageId);
  if (!target) throw new AppError('Image not found on this bike listing', 404);

  await BikeImage.update({ is_primary: false }, { where: { bike_id: bike.id } });
  await target.update({ is_primary: true });
  await invalidateBikeCaches(bike.id, bike.user_id);
  return { success: true, message: 'Primary image updated.' };
};

exports.uploadVideo = async (bikeId, userId, userRole, file) => {
  const bike = await Bike.findByPk(bikeId);
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') throw new AppError('Unauthorized', 403);
  const url = getFileUrl(file);
  if (!url) throw new AppError('Invalid video upload', 400);
  await bike.update({ video_url: url });
  await invalidateBikeCaches(bike.id, bike.user_id);
  return { video_url: url };
};

exports.uploadAudio = async (bikeId, userId, userRole, file) => {
  const bike = await Bike.findByPk(bikeId);
  if (!bike) throw new AppError('Bike listing not found', 404);
  if (bike.user_id !== userId && userRole !== 'admin') throw new AppError('Unauthorized', 403);
  const url = getFileUrl(file);
  if (!url) throw new AppError('Invalid audio upload', 400);
  await bike.update({ audio_url: url });
  await invalidateBikeCaches(bike.id, bike.user_id);
  return { audio_url: url };
};

/**
 * Similar & Recommended Bikes
 */
exports.getSimilarBikes = async (bikeId, limit = 4, viewerUserId = null) => {
  const refBike = await Bike.findByPk(bikeId);
  if (!refBike) throw new AppError('Bike not found', 404);

  const minP = Number(refBike.price) * 0.7;
  const maxP = Number(refBike.price) * 1.3;

  const rows = await Bike.findAll({
    where: {
      id: { [Op.ne]: refBike.id },
      status: 'active',
      [Op.or]: [
        { brand_id: refBike.brand_id },
        { price: { [Op.between]: [minP, maxP] } },
      ],
    },
    include: bikeIncludeList,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10) || 4,
  });

  const formatted = rows.map((r) => transformBike(r, viewerUserId ? { id: viewerUserId } : null));
  return await enrichBikesMetadata(formatted, viewerUserId);
};

exports.getRecommendedBikes = async (excludeBikeId = null, limit = 4, viewerUserId = null) => {
  const where = { status: 'active' };
  if (excludeBikeId) where.id = { [Op.ne]: excludeBikeId };

  const rows = await Bike.findAll({
    where,
    include: bikeIncludeList,
    order: [['views_count', 'DESC'], ['created_at', 'DESC']],
    limit: parseInt(limit, 10) || 4,
  });

  const formatted = rows.map((r) => transformBike(r, viewerUserId ? { id: viewerUserId } : null));
  return await enrichBikesMetadata(formatted, viewerUserId);
};

exports.getSimilarRecommended = async (bikeId = null, limit = 4, viewerUserId = null) => {
  const [similar, recommended] = await Promise.all([
    bikeId ? exports.getSimilarBikes(bikeId, limit, viewerUserId) : Promise.resolve([]),
    exports.getRecommendedBikes(bikeId, limit, viewerUserId),
  ]);
  return { similar, recommended };
};

/**
 * Catalog Helpers: Bike Types, Bike Brands, Bike Models
 */
exports.getBikeVehicleTypesWithCounts = async () => {
  const bikeCat = await Category.findOne({ where: { slug: 'bike' }, attributes: ['id'] });
  if (!bikeCat) return [];

  const types = await CarType.findAll({
    where: { is_active: true, category_id: bikeCat.id },
    order: [['order', 'ASC'], ['name', 'ASC']],
  });

  const counts = await Bike.findAll({
    attributes: ['vehicle_type_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    where: { status: 'active' },
    group: ['vehicle_type_id'],
    raw: true,
  });
  const countMap = {};
  counts.forEach((c) => { countMap[c.vehicle_type_id] = parseInt(c.count, 10) || 0; });

  return types.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    icon_url: t.icon_url,
    bike_count: countMap[t.id] || 0,
  }));
};

exports.getBikeBrandsWithCounts = async (options = {}) => {
  const bikeCat = await Category.findOne({ where: { slug: 'bike' }, attributes: ['id'] });
  if (!bikeCat) return [];

  const vehicleTypeId = options.vehicle_type_id || options.vehicleTypeId || null;
  let targetTypeIds = [];

  if (vehicleTypeId) {
    targetTypeIds = [vehicleTypeId];
  } else {
    const types = await CarType.findAll({ where: { is_active: true, category_id: bikeCat.id }, attributes: ['id'] });
    targetTypeIds = types.map((t) => t.id);
  }

  const mappedBrandTypes = targetTypeIds.length > 0
    ? await BrandType.findAll({ attributes: ['brand_id'], where: { type_id: targetTypeIds }, raw: true })
    : [];
  const brandIdsSet = new Set(mappedBrandTypes.map((b) => b.brand_id));

  const activeBikes = await Bike.findAll({
    attributes: ['brand_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    where: { status: 'active' },
    group: ['brand_id'],
    raw: true,
  });
  const countMap = {};
  activeBikes.forEach((b) => {
    countMap[b.brand_id] = parseInt(b.count, 10) || 0;
    brandIdsSet.add(b.brand_id);
  });

  const allBrandIds = Array.from(brandIdsSet);
  if (allBrandIds.length === 0) return [];

  const brands = await Brand.findAll({
    where: { id: allBrandIds, is_active: true },
    order: [['name', 'ASC']],
  });

  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    logo: b.logo || null,
    logo_url: b.logo || b.logoUrl || null,
    bike_count: countMap[b.id] || 0,
  }));
};

exports.getBikeModelsByBrand = async (brandIdentifier) => {
  const bikeCat = await Category.findOne({ where: { slug: 'bike' }, attributes: ['id'] });
  let brand = null;

  if (isUuid(brandIdentifier)) {
    brand = await Brand.findByPk(brandIdentifier);
  } else {
    const clean = String(brandIdentifier).replace(/-/g, ' ').trim().toLowerCase();
    brand = await Brand.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), clean),
    });
  }

  if (!brand) throw new AppError('Bike brand not found', 404);

  const where = {
    brandId: brand.id,
    is_active: { [Op.ne]: false },
  };
  if (bikeCat) {
    where[Op.or] = [
      { category_id: bikeCat.id },
      { body_type: { [Op.in]: ['Motorcycle', 'Scooter', 'Electric Two-Wheeler', 'Superbike', 'Adventure', 'Moped & Others'] } },
    ];
  }

  const models = await Model.findAll({
    where,
    attributes: ['id', 'brandId', 'name', 'body_type', 'image_url', 'start_year', 'end_year'],
    order: [['name', 'ASC']],
  });

  return { brand: { id: brand.id, name: brand.name, slug: brand.slug }, models };
};

/**
 * Record View on a Bike
 */
exports.recordView = async (idOrSlug, userId = null) => {
  const where = isUuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
  const bike = await Bike.findOne({ where });
  if (!bike) throw new AppError('Bike listing not found', 404);

  if (userId) {
    const existing = await View.findOne({
      where: { target_type: 'bike', target_id: bike.id, user_id: userId },
    });
    if (!existing) {
      await View.create({ target_type: 'bike', target_id: bike.id, user_id: userId, car_id: null });
      await bike.increment('views_count', { by: 1 });
    }
  } else {
    await View.create({ target_type: 'bike', target_id: bike.id, user_id: null, car_id: null });
    await bike.increment('views_count', { by: 1 });
  }

  await invalidateBikeCaches(bike.id, bike.user_id);
  return { views_count: (bike.views_count || 0) + 1 };
};
