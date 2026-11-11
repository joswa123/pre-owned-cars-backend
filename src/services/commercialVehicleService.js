const {
  CommercialVehicle,
  CommercialVehicleImage,
  User,
  DealerProfile,
  CarType,
  Brand,
  State,
  District,
  City,
  Wishlist,
  Lead,
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');
const { generateUniqueSlug } = require('../utils/slugify');
const {
  extractPublicIdFromUrl,
  getOptimizedCloudinaryUrl,
  deleteCloudinaryMedia,
} = require('../utils/cloudinaryHelper');
const {
  mapToCommercialDbValues,
  SORT_BY_WHITELIST,
} = require('../validations/commercialValidation');

const clearCache = async (key) => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.error('Redis clear cache error in commercialVehicleService:', err);
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

/**
 * Universal cache invalidator for commercial vehicle mutations
 */
const invalidateCommercialCaches = async (vehicleId = null, userId = null) => {
  try {
    if (vehicleId) {
      await clearCache(`commercial:${vehicleId}`);
    }
    await clearCachePattern('commercial:*');
    await clearCachePattern('seller:*');
    await clearCachePattern('global_search:*');

    const { clearCache: clearHttpCache } = require('../middlewares/cacheMiddleware');
    await clearHttpCache('/api/v1/commercial');
    await clearHttpCache('/api/commercial');
    await clearHttpCache('/api/v1/search');

    if (userId) {
      const dashboardService = require('./dashboardService');
      await dashboardService.invalidateDashboardCache(userId);
    }
  } catch (err) {
    console.error('Commercial cache invalidation error:', err);
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

/**
 * Formats commercial vehicle entity into standard response contract
 */
const transformCommercialVehicleImages = (vehicle, baseUrl = null, viewerUser = null) => {
  if (!vehicle) return null;
  const rawImages = vehicle.images || [];

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

  // Sort images: primary first, then by sort_order
  validImages.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const primaryItem = validImages.find((img) => img.is_primary) || validImages[0] || null;
  const secondaryImages = validImages.filter((img) => img !== primaryItem).map((img) => img.image_url);

  const vJson = typeof vehicle.toJSON === 'function' ? vehicle.toJSON() : { ...vehicle };

  // Format seller
  if (vJson.seller) {
    const rawSeller = vehicle.seller;
    const sellerDistrictName =
      rawSeller?.district?.name ||
      vJson.seller.district?.name ||
      (typeof vJson.seller.district === 'string' ? vJson.seller.district : null);
    const sellerCompanyName =
      rawSeller?.dealerProfile?.company_name ||
      vJson.seller.dealerProfile?.company_name ||
      vJson.seller.company_name ||
      null;

    const isAuthorized =
      viewerUser &&
      (viewerUser.id === vJson.user_id || viewerUser.role === 'admin');

    vJson.seller = {
      ...vJson.seller,
      phone: isAuthorized ? vJson.seller.phone : maskPhone(vJson.seller.phone),
      email: isAuthorized ? vJson.seller.email : maskEmail(vJson.seller.email),
      district: sellerDistrictName,
      company_name: sellerCompanyName,
    };
    delete vJson.seller.dealerProfile;
  }

  // Resolve Location
  let stateObj = vJson.state || (vehicle.state ? (typeof vehicle.state.toJSON === 'function' ? vehicle.state.toJSON() : vehicle.state) : null);
  let districtObj = vJson.district || (vehicle.district ? (typeof vehicle.district.toJSON === 'function' ? vehicle.district.toJSON() : vehicle.district) : null);
  let cityObj = vJson.city || (vehicle.city ? (typeof vehicle.city.toJSON === 'function' ? vehicle.city.toJSON() : vehicle.city) : null);

  if (typeof stateObj === 'string') stateObj = { name: stateObj };
  if (typeof districtObj === 'string') districtObj = { name: districtObj };
  if (typeof cityObj === 'string') cityObj = { name: cityObj };

  const districtName = districtObj?.name || null;
  const cityName = cityObj?.name || null;
  const stateName = stateObj?.name || null;
  const locationText = [cityName, districtName, stateName].filter(Boolean).join(', ') || null;

  vJson.state = stateObj;
  vJson.district = districtObj;
  vJson.city = cityObj;
  vJson.cities = cityObj;
  vJson.districtName = districtName;
  vJson.cityName = cityName;
  vJson.stateName = stateName;
  vJson.district_name = districtName;
  vJson.city_name = cityName;
  vJson.state_name = stateName;
  vJson.location_text = locationText;

  // Type & Brand helpers
  const vehicleTypeName = vJson.vehicleType?.name || null;
  const brandName = vJson.brand?.name || null;

  const price = (vJson.price !== null && vJson.price !== undefined) ? Number(vJson.price) : null;
  const is_expired = vJson.created_at && (Date.now() - new Date(vJson.created_at).getTime()) > 90 * 24 * 60 * 60 * 1000;

  return {
    ...vJson,
    price,
    vehicle_type: vehicleTypeName,
    brand_name: brandName,
    primary_image: primaryItem ? primaryItem.image_url : null,
    secondary_images: secondaryImages,
    images: validImages,
    is_expired,
  };
};

exports.transformCommercialVehicleImages = transformCommercialVehicleImages;

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
 * Create a new Commercial Vehicle listing
 */
exports.createCommercialVehicle = async (userId, userRole, rawData, files) => {
  const transaction = await sequelize.transaction();
  const createdUploads = [];

  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found', 404);

    const mapped = mapToCommercialDbValues(rawData);

    // 1. Resolve vehicle_type_id
    const typeInput = mapped.vehicle_type_id || mapped.vehicle_type;
    if (!typeInput) throw new AppError('vehicle_type_id or vehicle_type is required', 400);

    let vehicleType = null;
    if (isUuid(typeInput)) {
      vehicleType = await CarType.findByPk(typeInput, { transaction });
    } else {
      vehicleType = await CarType.findOne({
        where: {
          [Op.or]: [
            { slug: typeInput.toLowerCase().trim() },
            { name: typeInput.trim() },
          ],
        },
        transaction,
      });
    }
    if (!vehicleType) throw new AppError(`Invalid vehicle type: ${typeInput}`, 400);

    // 2. Resolve brand_id
    const brandInput = mapped.brand_id || mapped.brand;
    if (!brandInput) throw new AppError('brand_id or brand is required', 400);

    let brand = null;
    if (isUuid(brandInput)) {
      brand = await Brand.findByPk(brandInput, { transaction });
    } else {
      brand = await Brand.findOne({
        where: { name: brandInput.trim() },
        transaction,
      });
    }
    if (!brand) throw new AppError(`Invalid brand: ${brandInput}`, 400);

    // 3. Location Hierarchy Validation & Resolution
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

    // 4. Derive posted_by_type
    const posted_by_type = userRole === 'dealer' ? 'dealer' : 'customer';

    // 5. Slug Generation
    const baseSlugName = `${brand.name}-${vehicleType.name}-${mapped.year}`;
    const slug = await generateUniqueSlug(CommercialVehicle, baseSlugName, null, { transaction });

    // 6. Create Vehicle Row
    const vehicle = await CommercialVehicle.create({
      user_id: userId,
      vehicle_type_id: vehicleType.id,
      brand_id: brand.id,
      year: mapped.year,
      fuel_type: mapped.fuel_type,
      ownership: mapped.ownership,
      km_driven: mapped.km_driven,
      price: mapped.price,
      price_negotiable: mapped.price_negotiable || false,
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

    // 7. Process Images
    const imageRecords = [];

    // Primary Image resolution
    let primaryUrl = null;
    let primaryPublicId = null;

    if (files && files.primary_image && files.primary_image[0]) {
      primaryUrl = getFileUrl(files.primary_image[0]);
      primaryPublicId = getFilePublicId(files.primary_image[0], primaryUrl);
    } else if (rawData.primary_image && typeof rawData.primary_image === 'string') {
      primaryUrl = getFileUrl(rawData.primary_image);
      primaryPublicId = extractPublicIdFromUrl(primaryUrl);
    } else if (files && files.secondary_images && files.secondary_images[0]) {
      primaryUrl = getFileUrl(files.secondary_images[0]);
      primaryPublicId = getFilePublicId(files.secondary_images[0], primaryUrl);
    } else if (files && files.images && files.images[0]) {
      primaryUrl = getFileUrl(files.images[0]);
      primaryPublicId = getFilePublicId(files.images[0], primaryUrl);
    }

    if (!primaryUrl) {
      throw new AppError('Primary image is required. Provide at least one valid image.', 400);
    }

    imageRecords.push({
      commercial_vehicle_id: vehicle.id,
      image_url: primaryUrl,
      public_id: primaryPublicId,
      is_primary: true,
      sort_order: 0,
    });
    if (primaryPublicId) createdUploads.push(primaryPublicId);

    // Secondary Images resolution
    const secFiles = (files ? files.secondary_images || files.images || [] : []);
    const startIndex = (files && (!files.primary_image || !files.primary_image[0]) && secFiles.length > 0) ? 1 : 0;

    let order = 1;
    for (let i = startIndex; i < secFiles.length; i++) {
      const sUrl = getFileUrl(secFiles[i]);
      if (sUrl) {
        const sPid = getFilePublicId(secFiles[i], sUrl);
        imageRecords.push({
          commercial_vehicle_id: vehicle.id,
          image_url: sUrl,
          public_id: sPid,
          is_primary: false,
          sort_order: order++,
        });
        if (sPid) createdUploads.push(sPid);
      }
    }

    // Secondary images passed via JSON body URLs
    const bodyImages = rawData.secondary_images || rawData.images;
    if (Array.isArray(bodyImages)) {
      for (const bImg of bodyImages) {
        const bUrl = typeof bImg === 'string' ? bImg : bImg?.image_url;
        if (bUrl && bUrl !== primaryUrl) {
          const sPid = extractPublicIdFromUrl(bUrl);
          imageRecords.push({
            commercial_vehicle_id: vehicle.id,
            image_url: bUrl,
            public_id: sPid,
            is_primary: false,
            sort_order: order++,
          });
        }
      }
    }

    await CommercialVehicleImage.bulkCreate(imageRecords, { transaction });

    await transaction.commit();

    await invalidateCommercialCaches(vehicle.id, userId);

    const fullVehicle = await CommercialVehicle.findByPk(vehicle.id, {
      include: [
        { model: CommercialVehicleImage, as: 'images' },
        sellerInclude,
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
      ],
    });

    return transformCommercialVehicleImages(fullVehicle, null, { id: userId, role: userRole });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    // Clean up uploaded Cloudinary images if transaction failed
    for (const pid of createdUploads) {
      deleteCloudinaryMedia(pid).catch(() => {});
    }
    if (error instanceof AppError) throw error;
    if (error.name === 'SequelizeValidationError') {
      throw new AppError(error.errors?.[0]?.message || 'Validation error', 400);
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('A listing with this specification already exists', 400);
    }
    throw new AppError(error.message || 'Failed to create commercial vehicle listing', 500);
  }
};

/**
 * Build where clause for commercial vehicle queries
 */
const buildCommercialFiltersWhere = async (rawFilters = {}) => {
  const where = {};
  const queryModel = CommercialVehicle;

  // 1. Status: default to active unless specified
  if (rawFilters.status && rawFilters.status !== 'all') {
    where.status = rawFilters.status;
  } else if (!rawFilters.status) {
    where.status = 'active';
  }

  // 2. Vehicle Types
  const rawTypes = rawFilters.vehicle_types || rawFilters.vehicle_type || rawFilters.vehicle_type_id || rawFilters.vehicleType;
  if (rawTypes) {
    const typeItems = (Array.isArray(rawTypes) ? rawTypes : String(rawTypes).split(',')).map(t => String(t).trim()).filter(Boolean);
    const resolvedTypeIds = [];
    const nameTypeItems = [];

    for (const item of typeItems) {
      if (isUuid(item)) {
        resolvedTypeIds.push(item);
      } else {
        nameTypeItems.push(item);
      }
    }

    if (nameTypeItems.length) {
      const foundTypes = await CarType.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.in]: nameTypeItems } },
            { slug: { [Op.in]: nameTypeItems.map(s => s.toLowerCase()) } },
          ],
        },
        attributes: ['id'],
      });
      resolvedTypeIds.push(...foundTypes.map(t => t.id));
    }

    const uniqueTypeIds = [...new Set(resolvedTypeIds)];
    where.vehicle_type_id = { [Op.in]: uniqueTypeIds.length ? uniqueTypeIds : ['00000000-0000-0000-0000-000000000000'] };
  }

  // 3. Brands
  const rawBrands = rawFilters.brands || rawFilters.brand || rawFilters.brand_id;
  if (rawBrands) {
    const brandItems = (Array.isArray(rawBrands) ? rawBrands : String(rawBrands).split(',')).map(b => String(b).trim()).filter(Boolean);
    const resolvedBrandIds = [];
    const nameBrandItems = [];

    for (const item of brandItems) {
      if (isUuid(item)) {
        resolvedBrandIds.push(item);
      } else {
        nameBrandItems.push(item);
      }
    }

    if (nameBrandItems.length) {
      const foundBrands = await Brand.findAll({
        where: {
          name: { [Op.in]: nameBrandItems },
        },
        attributes: ['id'],
      });
      resolvedBrandIds.push(...foundBrands.map(b => b.id));
    }

    const uniqueBrandIds = [...new Set(resolvedBrandIds)];
    where.brand_id = { [Op.in]: uniqueBrandIds.length ? uniqueBrandIds : ['00000000-0000-0000-0000-000000000000'] };
  }

  // 4. Price range
  const minPrice = rawFilters.min_price ?? rawFilters.minPrice;
  const maxPrice = rawFilters.max_price ?? rawFilters.maxPrice;
  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    const parsedMin = parseFloat(minPrice);
    if (!isNaN(parsedMin)) where.price = { ...(where.price || {}), [Op.gte]: parsedMin };
  }
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    const parsedMax = parseFloat(maxPrice);
    if (!isNaN(parsedMax)) where.price = { ...(where.price || {}), [Op.lte]: parsedMax };
  }

  // 5. KM Driven range
  const minKm = rawFilters.min_km ?? rawFilters.minKm;
  const maxKm = rawFilters.max_km ?? rawFilters.maxKm;
  if (minKm !== undefined && minKm !== null && minKm !== '') {
    const parsedMin = parseInt(minKm, 10);
    if (!isNaN(parsedMin)) where.km_driven = { ...(where.km_driven || {}), [Op.gte]: parsedMin };
  }
  if (maxKm !== undefined && maxKm !== null && maxKm !== '') {
    const parsedMax = parseInt(maxKm, 10);
    if (!isNaN(parsedMax)) where.km_driven = { ...(where.km_driven || {}), [Op.lte]: parsedMax };
  }

  // 6. Year range
  const minYear = rawFilters.min_year ?? rawFilters.minYear;
  const maxYear = rawFilters.max_year ?? rawFilters.maxYear;
  const exactYear = rawFilters.year;
  if (exactYear !== undefined && exactYear !== null && exactYear !== '') {
    const parsedYear = parseInt(exactYear, 10);
    if (!isNaN(parsedYear)) where.year = parsedYear;
  } else {
    if (minYear !== undefined && minYear !== null && minYear !== '') {
      const parsedMin = parseInt(minYear, 10);
      if (!isNaN(parsedMin)) where.year = { ...(where.year || {}), [Op.gte]: parsedMin };
    }
    if (maxYear !== undefined && maxYear !== null && maxYear !== '') {
      const parsedMax = parseInt(maxYear, 10);
      if (!isNaN(parsedMax)) where.year = { ...(where.year || {}), [Op.lte]: parsedMax };
    }
  }

  // 7. Fuel types
  const rawFuel = rawFilters.fuel_types || rawFilters.fuel_type || rawFilters.fueltype;
  if (rawFuel) {
    const fuelList = (Array.isArray(rawFuel) ? rawFuel : String(rawFuel).split(','))
      .map(f => String(f).trim().toLowerCase())
      .filter(Boolean);
    const mappedFuels = fuelList.map(f => {
      const map = { petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG', electric: 'Electric', hybrid: 'Hybrid', lpg: 'LPG' };
      return map[f] || f;
    });
    if (mappedFuels.length === 1) {
      where.fuel_type = mappedFuels[0];
    } else if (mappedFuels.length > 1) {
      where.fuel_type = { [Op.in]: mappedFuels };
    }
  }

  // 8. Ownership
  const rawOwn = rawFilters.ownerships || rawFilters.ownership;
  if (rawOwn) {
    const ownList = (Array.isArray(rawOwn) ? rawOwn : String(rawOwn).split(','))
      .map(o => String(o).trim().toLowerCase())
      .filter(Boolean);
    const mappedOwns = ownList.map(o => {
      const map = { '1st owner': '1st Owner', '2nd owner': '2nd Owner', '3rd owner': '3rd Owner', '4th+ owner': '4th+ Owner' };
      return map[o] || o;
    });
    if (mappedOwns.length === 1) {
      where.ownership = mappedOwns[0];
    } else if (mappedOwns.length > 1) {
      where.ownership = { [Op.in]: mappedOwns };
    }
  }

  // 9. Locations
  if (rawFilters.state_id) where.state_id = rawFilters.state_id;
  if (rawFilters.district_id) where.district_id = rawFilters.district_id;
  if (rawFilters.city_id) where.city_id = rawFilters.city_id;

  // 10. Search query
  if (rawFilters.search || rawFilters.q) {
    const searchTerm = String(rawFilters.search || rawFilters.q).trim();
    if (searchTerm) {
      const sanitized = searchTerm.replace(/'/g, "''");
      const searchWhere = [
        { description: { [Op.like]: `%${searchTerm}%` } },
        sequelize.literal(`EXISTS (SELECT 1 FROM brands WHERE brands.id = CommercialVehicle.brand_id AND brands.name LIKE '%${sanitized}%')`),
        sequelize.literal(`EXISTS (SELECT 1 FROM car_types WHERE car_types.id = CommercialVehicle.vehicle_type_id AND car_types.name LIKE '%${sanitized}%')`),
      ];
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push({ [Op.or]: searchWhere });
    }
  }

  // 11. Posted by type
  if (rawFilters.posted_by_type && ['dealer', 'customer'].includes(String(rawFilters.posted_by_type).toLowerCase())) {
    where.posted_by_type = String(rawFilters.posted_by_type).toLowerCase();
  }

  // 12. Posted within days & Expired cutoff (aligned with carService.js)
  let minCreatedAt = null;
  const rawPostedDays = rawFilters.posted_within_days ?? rawFilters.postedWithinDays;
  if (rawPostedDays !== undefined && rawPostedDays !== null && rawPostedDays !== '') {
    const days = parseInt(rawPostedDays, 10);
    if (!isNaN(days) && days >= 1) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      minCreatedAt = cutoffDate;
    }
  }

  const includeExpired = rawFilters.include_expired === true || rawFilters.include_expired === 'true';
  if (!includeExpired) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (!minCreatedAt || ninetyDaysAgo > minCreatedAt) {
      minCreatedAt = ninetyDaysAgo;
    }
  }

  if (minCreatedAt) {
    where.created_at = { ...(where.created_at || {}), [Op.gte]: minCreatedAt };
  }

  return { where, queryModel };
};

/**
 * Get Public Commercial Vehicles List with Filters
 */
exports.getCommercialVehicles = async (
  rawFilters = {},
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  viewerUserId = null,
  viewerUserRole = null
) => {
  // Validate sort_by strictly against whitelist
  const requestedSortBy = rawFilters.sort_by || rawFilters.sortBy || sortBy;
  if (requestedSortBy && !SORT_BY_WHITELIST.includes(requestedSortBy)) {
    throw new AppError(`Invalid sort field "${requestedSortBy}". Allowed sort fields: ${SORT_BY_WHITELIST.join(', ')}`, 400);
  }
  const validSort = requestedSortBy || 'created_at';
  const validOrder = (rawFilters.sort_order || rawFilters.sortOrder || sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { where, queryModel } = await buildCommercialFiltersWhere(rawFilters);

  const parsedPage = Math.max(parseInt(rawFilters.page || page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(rawFilters.limit || limit, 10) || 20, 1), 100);
  const offset = (parsedPage - 1) * parsedLimit;

  const { count, rows } = await queryModel.findAndCountAll({
    where,
    distinct: true,
    col: 'id',
    include: [
      { model: CommercialVehicleImage, as: 'images', attributes: ['id', 'image_url', 'is_primary', 'sort_order'] },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
    limit: parsedLimit,
    offset,
    order: [[validSort, validOrder]],
  });

  // Get wishlists for viewer
  let wishlistSet = new Set();
  if (viewerUserId) {
    const userWishlists = await Wishlist.findAll({
      where: { user_id: viewerUserId, target_type: 'commercial' },
      attributes: ['target_id'],
    });
    wishlistSet = new Set(userWishlists.map(w => w.target_id));
  }

  const vehicles = rows.map((v) => {
    const transformed = transformCommercialVehicleImages(v, null, { id: viewerUserId, role: viewerUserRole });
    return {
      ...transformed,
      isWishlist: wishlistSet.has(v.id),
    };
  });

  return {
    total: count,
    vehicles,
    cars: vehicles, // alias for frontend component compatibility
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(count / parsedLimit) || 1,
  };
};

/**
 * Get Commercial Vehicle by ID or Slug
 */
exports.getCommercialVehicleById = async (identifier, viewerUser = null) => {
  const isId = isUuid(identifier);
  const where = isId ? { id: identifier } : { slug: identifier };

  const vehicle = await CommercialVehicle.findOne({
    where,
    include: [
      {
        model: CommercialVehicleImage,
        as: 'images',
        attributes: ['id', 'image_url', 'is_primary', 'sort_order', 'created_at'],
      },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
  });

  if (!vehicle) {
    throw new AppError('Commercial vehicle not found.', 404);
  }

  // Increment views count
  await vehicle.increment('views_count');

  // Check wishlist status
  let isWishlist = false;
  if (viewerUser && viewerUser.id) {
    const count = await Wishlist.count({
      where: { user_id: viewerUser.id, target_type: 'commercial', target_id: vehicle.id },
    });
    isWishlist = count > 0;
  }

  const transformed = transformCommercialVehicleImages(vehicle, null, viewerUser);
  return {
    ...transformed,
    isWishlist,
  };
};

/**
 * Get Listings owned by current seller
 */
exports.getSellerCommercialVehicles = async (sellerId, filters = {}) => {
  const where = { user_id: sellerId };
  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  } else {
    where.status = { [Op.ne]: 'deleted' };
  }

  const parsedPage = Math.max(parseInt(filters.page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
  const offset = (parsedPage - 1) * parsedLimit;

  const { count, rows } = await CommercialVehicle.findAndCountAll({
    where,
    distinct: true,
    col: 'id',
    include: [
      { model: CommercialVehicleImage, as: 'images' },
      sellerInclude,
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
      { model: Lead, as: 'leads', attributes: ['id'] },
    ],
    limit: parsedLimit,
    offset,
    order: [['created_at', 'DESC']],
  });

  const vehicles = rows.map((v) => {
    const transformed = transformCommercialVehicleImages(v, null, { id: sellerId, role: 'seller' });
    return {
      ...transformed,
      enquiry_count: v.leads?.length || 0,
    };
  });

  return {
    total: count,
    vehicles,
    cars: vehicles,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(count / parsedLimit) || 1,
  };
};

/**
 * Update Commercial Vehicle
 */
exports.updateCommercialVehicle = async (id, userId, userRole, rawData, files) => {
  const vehicle = await CommercialVehicle.findByPk(id);
  if (!vehicle) throw new AppError('Commercial vehicle not found', 404);

  // Ownership check
  if (vehicle.user_id !== userId && userRole !== 'admin') {
    throw new AppError('You are not authorized to edit this listing', 403);
  }

  const mapped = mapToCommercialDbValues(rawData);
  const filteredData = {};

  if (mapped.price !== undefined && mapped.price !== null && mapped.price !== '') {
    filteredData.price = Number(mapped.price);
  }
  if (mapped.price_negotiable !== undefined) {
    filteredData.price_negotiable = Boolean(mapped.price_negotiable);
  }
  if (mapped.km_driven !== undefined) filteredData.km_driven = mapped.km_driven;
  if (mapped.fuel_type !== undefined) filteredData.fuel_type = mapped.fuel_type;
  if (mapped.ownership !== undefined) filteredData.ownership = mapped.ownership;
  if (mapped.year !== undefined) filteredData.year = mapped.year;
  if (mapped.description !== undefined) filteredData.description = mapped.description;
  if (mapped.status !== undefined) filteredData.status = mapped.status;

  if (mapped.vehicle_type_id || mapped.vehicle_type) {
    const typeInput = mapped.vehicle_type_id || mapped.vehicle_type;
    const vType = isUuid(typeInput)
      ? await CarType.findByPk(typeInput)
      : await CarType.findOne({ where: { [Op.or]: [{ slug: typeInput.toLowerCase() }, { name: typeInput }] } });
    if (vType) filteredData.vehicle_type_id = vType.id;
  }

  if (mapped.brand_id || mapped.brand) {
    const brandInput = mapped.brand_id || mapped.brand;
    const br = isUuid(brandInput)
      ? await Brand.findByPk(brandInput)
      : await Brand.findOne({ where: { name: brandInput } });
    if (br) filteredData.brand_id = br.id;
  }

  if (mapped.state_id !== undefined) filteredData.state_id = mapped.state_id || null;
  if (mapped.district_id !== undefined) filteredData.district_id = mapped.district_id || null;
  if (mapped.city_id !== undefined) filteredData.city_id = mapped.city_id || null;

  const transaction = await sequelize.transaction();
  try {
    await vehicle.update(filteredData, { transaction });

    // Handle replace images if requested
    if (rawData.replace_images === true || rawData.replace_images === 'true') {
      const oldImages = await CommercialVehicleImage.findAll({
        where: { commercial_vehicle_id: vehicle.id },
        transaction,
      });
      for (const img of oldImages) {
        if (img.public_id) deleteCloudinaryMedia(img.public_id).catch(() => {});
      }
      await CommercialVehicleImage.destroy({
        where: { commercial_vehicle_id: vehicle.id },
        transaction,
      });
    }

    // Handle new uploaded images
    const imageRecords = [];
    if (files && files.primary_image && files.primary_image[0]) {
      const pUrl = getFileUrl(files.primary_image[0]);
      if (pUrl) {
        // unset existing primary first
        await CommercialVehicleImage.update(
          { is_primary: false },
          { where: { commercial_vehicle_id: vehicle.id }, transaction }
        );
        imageRecords.push({
          commercial_vehicle_id: vehicle.id,
          image_url: pUrl,
          public_id: getFilePublicId(files.primary_image[0], pUrl),
          is_primary: true,
          sort_order: 0,
        });
      }
    }

    const secFiles = (files ? files.secondary_images || files.images || [] : []);
    let order = 10;
    for (const file of secFiles) {
      const sUrl = getFileUrl(file);
      if (sUrl) {
        imageRecords.push({
          commercial_vehicle_id: vehicle.id,
          image_url: sUrl,
          public_id: getFilePublicId(file, sUrl),
          is_primary: false,
          sort_order: order++,
        });
      }
    }

    if (imageRecords.length > 0) {
      await CommercialVehicleImage.bulkCreate(imageRecords, { transaction });
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await invalidateCommercialCaches(vehicle.id, userId);

  return exports.getCommercialVehicleById(vehicle.id, { id: userId, role: userRole });
};

/**
 * Delete Commercial Vehicle (Soft Delete)
 */
exports.deleteCommercialVehicle = async (id, userId, userRole) => {
  const vehicle = await CommercialVehicle.findByPk(id);
  if (!vehicle) throw new AppError('Commercial vehicle not found', 404);

  if (vehicle.user_id !== userId && userRole !== 'admin') {
    throw new AppError('You are not authorized to delete this listing', 403);
  }

  await vehicle.update({ status: 'deleted', deleted_at: new Date() });

  await invalidateCommercialCaches(vehicle.id, userId);

  return { success: true, message: 'Commercial vehicle deleted successfully.' };
};

/**
 * Mark Commercial Vehicle as Sold
 */
exports.markAsSold = async (id, userId, userRole) => {
  const vehicle = await CommercialVehicle.findByPk(id);
  if (!vehicle) throw new AppError('Commercial vehicle not found', 404);

  if (vehicle.user_id !== userId && userRole !== 'admin') {
    throw new AppError('You are not authorized to update this listing', 403);
  }

  if (vehicle.status === 'sold') {
    throw new AppError('Commercial vehicle is already marked as sold', 400);
  }

  await vehicle.update({ status: 'sold' });

  await invalidateCommercialCaches(vehicle.id, userId);

  return exports.getCommercialVehicleById(vehicle.id, { id: userId, role: userRole });
};

/**
 * Add Images to Commercial Vehicle
 */
exports.addImages = async (id, userId, userRole, files) => {
  const vehicle = await CommercialVehicle.findByPk(id);
  if (!vehicle) throw new AppError('Commercial vehicle not found', 404);

  if (vehicle.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized', 403);
  }

  const uploadedFiles = files?.images || files?.secondary_images || [];
  if (uploadedFiles.length === 0) {
    throw new AppError('No images uploaded', 400);
  }

  const existingCount = await CommercialVehicleImage.count({
    where: { commercial_vehicle_id: vehicle.id },
  });

  const records = [];
  let order = existingCount;
  for (const f of uploadedFiles) {
    const url = getFileUrl(f);
    if (url) {
      records.push({
        commercial_vehicle_id: vehicle.id,
        image_url: url,
        public_id: getFilePublicId(f, url),
        is_primary: false,
        sort_order: order++,
      });
    }
  }

  if (records.length > 0) {
    await CommercialVehicleImage.bulkCreate(records);
  }

  await invalidateCommercialCaches(vehicle.id, userId);

  return exports.getCommercialVehicleById(vehicle.id, { id: userId, role: userRole });
};

/**
 * Delete a specific Commercial Vehicle Image
 */
exports.deleteImage = async (id, imageId, userId, userRole) => {
  const vehicle = await CommercialVehicle.findByPk(id);
  if (!vehicle) throw new AppError('Commercial vehicle not found', 404);

  if (vehicle.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized', 403);
  }

  const image = await CommercialVehicleImage.findOne({
    where: { id: imageId, commercial_vehicle_id: vehicle.id },
  });
  if (!image) throw new AppError('Image not found', 404);

  const wasPrimary = image.is_primary;
  const publicId = image.public_id;

  const transaction = await sequelize.transaction();
  try {
    await image.destroy({ transaction });

    // If deleted image was primary, promote next image
    if (wasPrimary) {
      const nextImage = await CommercialVehicleImage.findOne({
        where: { commercial_vehicle_id: vehicle.id },
        order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
        transaction,
      });
      if (nextImage) {
        await nextImage.update({ is_primary: true }, { transaction });
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  if (publicId) deleteCloudinaryMedia(publicId).catch(() => {});

  await invalidateCommercialCaches(vehicle.id, userId);

  return { success: true, message: 'Image deleted successfully' };
};

/**
 * Set Primary Image for Commercial Vehicle
 */
exports.setPrimaryImage = async (id, imageId, userId, userRole) => {
  const vehicle = await CommercialVehicle.findByPk(id);
  if (!vehicle) throw new AppError('Commercial vehicle not found', 404);

  if (vehicle.user_id !== userId && userRole !== 'admin') {
    throw new AppError('Unauthorized', 403);
  }

  const targetImage = await CommercialVehicleImage.findOne({
    where: { id: imageId, commercial_vehicle_id: vehicle.id },
  });
  if (!targetImage) throw new AppError('Image not found', 404);

  const transaction = await sequelize.transaction();
  try {
    // 1. Unset all existing primaries for this vehicle
    await CommercialVehicleImage.update(
      { is_primary: false },
      { where: { commercial_vehicle_id: vehicle.id, is_primary: true }, transaction }
    );

    // 2. Set target image as primary
    await targetImage.update({ is_primary: true }, { transaction });

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await invalidateCommercialCaches(vehicle.id, userId);

  return { success: true, message: 'Primary image updated successfully' };
};
