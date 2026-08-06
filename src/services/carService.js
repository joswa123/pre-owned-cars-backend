const { Car, CarImage, User, Wishlist, Lead, State, District, City, Brand } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');

const clearCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis clear cache error:', err);
  }
};

const clearCachePattern = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis clear pattern error:', err);
  }
};
const { mapToDbValues } = require('../validations/carValidation');

/**
 * Helper to transform car images into absolute URLs
 */
const transformCarImages = (car, baseUrl = null) => {
  const images = car.images || [];
  const primary = images.find((img) => img.is_primary === true);
  const secondary = images.filter((img) => img.is_primary !== true);
  const base = baseUrl || process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';

  const toAbsolute = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return {
    ...car.toJSON(),
    primary_image: primary ? toAbsolute(primary.image_url) : null,
    secondary_images: secondary.map((img) => toAbsolute(img.image_url)),
    images: images.map((img) => ({
      ...img.toJSON(),
      image_url: toAbsolute(img.image_url),
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
    if (!brandId && mapped.brand) {
      const brandObj = await Brand.findOne({ where: { name: mapped.brand } });
      if (!brandObj) throw new AppError(`Brand "${mapped.brand}" not found.`, 400);
      brandId = brandObj.id;
    }
    if (!brandId) throw new AppError('Brand ID or brand name is required.', 400);

    const posted_by_type = user.role === 'dealer' ? 'dealer' : 'customer';
    const b2b_listing =
      user.role === 'dealer' && (mapped.b2b_listing === true || mapped.b2b_listing === 'true');

    const carFields = {
      user_id: userId,
      brand_id: brandId,
      model: mapped.model,
      variant: mapped.variant,
      year: mapped.year,
      price: mapped.price,
      price_negotiable: mapped.price_negotiable || false,
      km_driven: mapped.km_driven,
      fuel_type: mapped.fuel_type,
      transmission: mapped.transmission,
      ownership: mapped.ownership,
      body_type: mapped.body_type || 'SUV',
      board_type: mapped.board_type || 'OWN BOARD',
      insurance_expiry_date: mapped.insurance_expiry_date || null,
      insurance_type: mapped.insurance_type || 'Not Insured',
      b2b_listing,
      posted_by_type,
      status: mapped.status || 'active',
      description: mapped.description || null,
      color: mapped.color || '',
      number_plate: mapped.number_plate || '',
      prior_appointemnts: mapped.prior_appointemnts === true || mapped.prior_appointemnts === 'true',
      state_id: user.state_id || null,
      district_id: user.district_id || null,
      city_id: user.city_id || null,
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
    }

    const secondaryFiles = files ? files.images || [] : [];
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

    await transaction.commit();

    const createdCar = await Car.findByPk(car.id, {
      include: [
        { model: CarImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'city'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      ],
    });

    await clearCache('brands:with_counts');
    await clearCache('board_type_stats');
    await clearCachePattern('cars:list:*');
    return createdCar;
  } catch (error) {
    console.error('❌ CREATE CAR SERVICE ERROR:', error);
    await transaction.rollback();
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
    const cached = await redisClient.get(cacheKey);
    if (cached) cachedData = JSON.parse(cached);
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
    if (filters.body_type) where.body_type = filters.body_type;
    if (filters.board_type) where.board_type = filters.board_type;
    if (filters.min_price) where.price = { [Op.gte]: parseFloat(filters.min_price) };
    if (filters.max_price) {
      where.price = { ...where.price, [Op.lte]: parseFloat(filters.max_price) };
    }
    if (filters.brand_id) where.brand_id = filters.brand_id;
    if (filters.brand) {
      const brand = await Brand.findOne({ where: { name: filters.brand } });
      if (brand) where.brand_id = brand.id;
    }
    if (filters.model) where.model = { [Op.like]: `%${filters.model}%` };
    if (filters.fuel_type) where.fuel_type = filters.fuel_type;
    if (filters.transmission) where.transmission = filters.transmission;
    if (filters.state_id) where.state_id = filters.state_id;
    if (filters.district_id) where.district_id = filters.district_id;
    if (filters.city_id) where.city_id = filters.city_id;

    const queryResult = await Car.findAndCountAll({
      attributes: { include: ['created_at', 'deleted_at'] },
      distinct: true,
      col: 'id',
      where,
      include: [
        { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'city', 'profile_picture'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
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
    transformedCars = queryResult.rows.map((car) => transformCarImages(car, baseUrl));

    try {
      await redisClient.setEx(cacheKey, 60, JSON.stringify({ count, transformedCars }));
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
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      transformedCar = JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis cache error in getCarById:', err);
  }

  if (!transformedCar) {
    const car = await Car.findByPk(carId, {
      attributes: { include: ['created_at', 'deleted_at'] },
      include: [
        { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
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
    transformedCar = transformCarImages(car, baseUrl);

    try {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(transformedCar));
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
      { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'profile_picture'] },
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
 * Get listings belonging to logged-in user
 */
exports.getUserCars = async (userId, status = null) => {
  const whereClause = { user_id: userId };
  let queryModel = Car;
  
  if (status) {
    whereClause.status = status;
    if (status === 'deleted') {
      queryModel = Car.unscoped();
    }
  }

  const cars = await queryModel.findAll({
    where: whereClause,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  return cars.map((car) => transformCarImages(car, baseUrl));
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
      const brandObj = await Brand.findOne({ where: { name: mapped.brand } });
      if (brandObj) brandId = brandObj.id;
    }

    const filteredData = {};
    if (brandId) filteredData.brand_id = brandId;
    if (mapped.model !== undefined) filteredData.model = mapped.model;
    if (mapped.variant !== undefined) filteredData.variant = mapped.variant;
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

    if (files && (files.primary_image || files.images)) {
      const getFileUrl = (f) => f.path || f.secure_url || f.url || (f.filename ? `/uploads/cars/${f.filename}` : 'test-image.png');
      
      // Default to replacing all images if new ones are uploaded, unless images_to_keep is provided
      // or replace_images is explicitly set to false.
      const shouldReplaceAll = updateData.replace_images !== false && updateData.replace_images !== 'false' && updateData.images_to_keep === undefined;

      if (shouldReplaceAll) {
        await CarImage.destroy({ where: { car_id: car.id }, transaction });
      } else if (files.primary_image && files.primary_image[0]) {
        // Only replace primary if not replacing all
        await CarImage.destroy({ where: { car_id: car.id, is_primary: true }, transaction });
      }

      const imageRecords = [];
      if (files.primary_image && files.primary_image[0]) {
        imageRecords.push({
          car_id: car.id,
          image_url: getFileUrl(files.primary_image[0]),
          is_primary: true,
        });
      }

      if (files.images && files.images.length > 0) {
        files.images.forEach(file => {
          imageRecords.push({
            car_id: car.id,
            image_url: getFileUrl(file),
            is_primary: false,
          });
        });
      }

      if (imageRecords.length > 0) {
        await CarImage.bulkCreate(imageRecords, { transaction });
      }
    }

    await transaction.commit();

    const updatedCar = await Car.findByPk(car.id, {
      include: [
        { model: CarImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'city'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      ],
    });

    await clearCache('brands:with_counts');
    await clearCache('board_type_stats');
    await clearCache(`car:${carId}`);
    await clearCachePattern('cars:list:*');
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
    await clearCache(`car:${carId}`);
    await clearCachePattern('cars:list:*');
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Delete car listing (Soft Delete)
 */
exports.deleteCar = async (carId, userId) => {
  const car = await Car.findOne({ where: { id: carId, user_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  // Soft delete: update status and set deleted_at
  await car.update({ status: 'deleted', deleted_at: new Date() });
  
  await clearCache('brands:with_counts');
  await clearCache('board_type_stats');
  await clearCache(`car:${carId}`);
  await clearCachePattern('cars:list:*');
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
      { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'profile_picture'] },
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
  await clearCache('brands:with_counts');
  await clearCache('board_type_stats');
  await clearCache(`car:${carId}`);
  await clearCachePattern('cars:list:*');
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
  await clearCache('brands:with_counts');
  await clearCache('board_type_stats');
  await clearCache(`car:${carId}`);
  await clearCachePattern('cars:list:*');
  return car;
};

/**
 * Get active car counts grouped by board type
 */
exports.getBoardTypeStats = async () => {
  const cacheKey = 'board_type_stats';
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

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
      where: { status: 'active', b2b_listing: true }
    })
  ]);

  const stats = { 'OWN BOARD': 0, 'T-BOARD': 0, 'COMMERCIAL': 0, 'B2B': b2bCount };
  results.forEach(r => {
    if (r.board_type && stats[r.board_type] !== undefined) {
      stats[r.board_type] = parseInt(r.get('count'));
    }
  });

  await redisClient.setEx(cacheKey, 60, JSON.stringify(stats));
  return stats;
};