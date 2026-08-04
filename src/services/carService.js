const { Car, CarImage, User, Wishlist, Lead } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');
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

    const posted_by_type = user.role === 'dealer' ? 'dealer' : 'customer';
    const b2b_listing =
      user.role === 'dealer' && (mapped.b2b_listing === true || mapped.b2b_listing === 'true');

    const carFields = {
      user_id: userId,
      brand: mapped.brand,
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
      board_type: mapped.board_type || 'White',
      insurance_expiry_date: mapped.insurance_expiry_date || null,
      insurance_type: mapped.insurance_type || 'Not Insured',
      b2b_listing,
      posted_by_type,
      status: mapped.status || 'active',
      description: mapped.description || null,
      color: mapped.color || '',
      number_plate: mapped.number_plate || '',
      prior_appointemnts: mapped.prior_appointemnts === true || mapped.prior_appointemnts === 'true',
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
      ],
    });

    return createdCar;
  } catch (error) {
    console.error('❌ CREATE CAR SERVICE ERROR:', error);
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get public car listings with filters
 */
exports.getCars = async (
  filters = {},
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  userId = null
) => {
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
  if (filters.brand) where.brand = filters.brand;
  if (filters.model) where.model = { [Op.like]: `%${filters.model}%` };
  if (filters.fuel_type) where.fuel_type = filters.fuel_type;
  if (filters.transmission) where.transmission = filters.transmission;

  const { count, rows } = await Car.findAndCountAll({
    distinct: true,
    col: 'id',
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'city', 'profile_picture'] },
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = rows.map((car) => transformCarImages(car, baseUrl));

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
  const car = await Car.findByPk(carId, {
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'] },
    ],
  });
  if (!car) throw new AppError('Car not found.', 404);

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCar = transformCarImages(car, baseUrl);

  const wishlistSet = await getWishlistSet(userId);
  return {
    ...transformedCar,
    isWishlist: wishlistSet.has(car.id),
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
exports.getUserCars = async (userId) => {
  const cars = await Car.findAll({
    where: { user_id: userId },
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
    ],
    order: [['created_at', 'DESC']],
  });

  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  return cars.map((car) => transformCarImages(car, baseUrl));
};

/**
 * Update car listing
 */
exports.updateCar = async (carId, userId, updateData) => {
  const car = await Car.findOne({ where: { id: carId, user_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  const mapped = mapToDbValues(updateData || {});

  const filteredData = {};
  if (mapped.brand !== undefined) filteredData.brand = mapped.brand;
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

  await car.update(filteredData);
  return car;
};

/**
 * Delete car listing
 */
exports.deleteCar = async (carId, userId) => {
  const car = await Car.findOne({ where: { id: carId, user_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  await CarImage.destroy({ where: { car_id: carId } });
  if (Wishlist) await Wishlist.destroy({ where: { car_id: carId } });
  if (Lead) await Lead.destroy({ where: { car_id: carId } });

  await car.destroy();
  return { success: true };
};

/**
 * Admin: Get all cars
 */
exports.getAdminCars = async (filters = {}, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC') => {
  const offset = (page - 1) * limit;
  const where = {};

  if (filters.posted_by_type) where.posted_by_type = filters.posted_by_type;
  if (filters.b2b_listing !== undefined) {
    where.b2b_listing = filters.b2b_listing === 'true' || filters.b2b_listing === true;
  }
  if (filters.status !== undefined) {
    where.status = filters.status;
  }

  const { count, rows } = await Car.findAndCountAll({
    distinct: true,
    col: 'id',
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'role', 'profile_picture'] },
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
  return car;
};