
// services/carService.js
const { Car, CarImage, User } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');


// Helper to transform car images and make URLs absolute
const transformCarImages = (car, baseUrl = null) => {
  const images = car.images || [];
  const primary = images.find(img => img.is_primary === true);
  const secondary = images.filter(img => img.is_primary !== true);
  const base = baseUrl || process.env.BASE_URL || ' https://repose-anthill-durably.ngrok-free.dev';

  const toAbsolute = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // If it's a local path, prepend base URL
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return {
    ...car.toJSON(),
    primary_image: primary ? toAbsolute(primary.image_url) : null,
    secondary_images: secondary.map(img => toAbsolute(img.image_url)),
    // Keep the original images array for backward compatibility
    images: images.map(img => ({
      ...img.toJSON(),
      image_url: toAbsolute(img.image_url),
    })),
  };
};
/**
 * Create a car listing with primary + secondary images.
 * 
 * @param {string} userId - Logged-in user ID.
 * @param {object} carData - Text fields from req.body.
 * @param {object} files - Multer files: { primary_image: [file], images: [file] }
 */
exports.createCar = async (userId, carData, files) => {
  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found.', 404);

    // ─── Car Fields ─────────────────────────────────────────────
    const carFields = {
      dealer_id: userId,
      brand: carData.brand,
      model: carData.model,
      variant: carData.variant,
      year: carData.year,
      purchase_date: carData.purchasedate,
      number_plate: carData.numplate,
      price: carData.price,
      price_negotiable: carData.price_negotiable || false,
      exterior_colour: carData.exteriorColour,
      interior_colour: carData.interiorColour,
      km_driven: carData.kmdriven,
      fuel_type: carData.fueltype,
      transmission: carData.transmission,
      ownership: carData.ownership,
      state: carData.state,
      city: carData.city,
      car_type: carData.car_type,
      description: carData.description || null,
      status: 'pending',
    };

    const car = await Car.create(carFields, { transaction });

  // In createCar function
const imageRecords = [];
const primaryFile = files.primary_image ? files.primary_image[0] : null;
if (primaryFile) {
  imageRecords.push({
    car_id: car.id,
    image_url: primaryFile.path,   // ← Cloudinary URL
    is_primary: true,
  });
}
const secondaryFiles = files.images || [];
secondaryFiles.forEach((file) => {
  imageRecords.push({
    car_id: car.id,
    image_url: file.path,          // ← Cloudinary URL
    is_primary: false,
  });
});

    await CarImage.bulkCreate(imageRecords, { transaction });

    await transaction.commit();

    const createdCar = await Car.findByPk(car.id, {
      include: [{ model: CarImage, as: 'images' }],
    });

    return createdCar;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// ─── Other Methods (unchanged) ──────────────────────────────

exports.getCars = async (filters = {}, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC') => {
  const offset = (page - 1) * limit;
  const where = { status: 'active' }; // Only show approved cars

  // Apply filters (price, state, city, brand, etc.)
  if (filters.min_price) {
    where.price = { [Op.gte]: parseFloat(filters.min_price) };
  }
  if (filters.max_price) {
    where.price = { ...where.price, [Op.lte]: parseFloat(filters.max_price) };
  }
  if (filters.state) where.state = filters.state;
  if (filters.city) where.city = { [Op.like]: `%${filters.city}%` };
  if (filters.brand) where.brand = filters.brand;
  if (filters.model) where.model = { [Op.like]: `%${filters.model}%` };
  if (filters.min_km) {
    where.km_driven = { [Op.gte]: parseInt(filters.min_km) };
  }
  if (filters.max_km) {
    where.km_driven = { ...where.km_driven, [Op.lte]: parseInt(filters.max_km) };
  }
  if (filters.fuel_type) where.fuel_type = filters.fuel_type;
  if (filters.transmission) where.transmission = filters.transmission;
  if (filters.ownership) where.ownership = filters.ownership;
  if (filters.year) where.year = filters.year;

  const { count, rows } = await Car.findAndCountAll({
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: User, attributes: ['id', 'full_name', 'phone'] },
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  const baseUrl = process.env.BASE_URL || ' https://repose-anthill-durably.ngrok-free.dev';
  const transformedCars = rows.map(car => transformCarImages(car, baseUrl));

  return {
    total: count,
    cars: transformedCars,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

exports.getCarById = async (carId) => {
  const car = await Car.findByPk(carId, {
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: User, attributes: ['id', 'full_name', 'phone', 'email', 'city', 'state'] },
    ],
  });
  if (!car) throw new AppError('Car not found.', 404);

  // Increment views (async, don't wait)
  car.increment('views');

  const baseUrl = process.env.BASE_URL || ' https://repose-anthill-durably.ngrok-free.dev';
  return transformCarImages(car, baseUrl);
};

exports.getUserCars = async (userId) => {
  const cars = await Car.findAll({
    where: { dealer_id: userId },
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
    ],
    order: [['created_at', 'DESC']],
  });

  const baseUrl = process.env.BASE_URL || ' https://repose-anthill-durably.ngrok-free.dev';
  return cars.map(car => transformCarImages(car, baseUrl));
};
exports.updateCar = async (carId, userId, updateData) => {
  const car = await Car.findOne({ where: { id: carId, dealer_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  const allowedFields = [
    'brand', 'model', 'variant', 'year', 'purchase_date', 'number_plate',
    'price', 'exterior_colour', 'interior_colour', 'km_driven',
    'fuel_type', 'transmission', 'ownership', 'state', 'city', 'description',
  ];
  const filteredData = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) filteredData[field] = updateData[field];
  });

  await car.update(filteredData);
  return car;
};

exports.deleteCar = async (carId, userId) => {
  const car = await Car.findOne({ where: { id: carId, dealer_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);
  await CarImage.destroy({ where: { car_id: carId } });
  await car.destroy();
  return { success: true };
};