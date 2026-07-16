
// services/carService.js
const { Car, CarImage, User } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');

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

    // ─── Images ──────────────────────────────────────────────────
    const imageRecords = [];

    // 1. Primary image (MANDATORY – exactly 1)
    const primaryFile = files.primary_image ? files.primary_image[0] : null;
    if (!primaryFile) {
      throw new AppError('Primary image is required.', 400);
    }
    imageRecords.push({
      car_id: car.id,
      image_url: `/uploads/${primaryFile.filename}`,
      is_primary: true,
    });

    // 2. Secondary images (OPTIONAL – as many as user uploads, up to multer limit)
    const secondaryFiles = files.images || [];
    secondaryFiles.forEach((file) => {
      imageRecords.push({
        car_id: car.id,
        image_url: `/uploads/${file.filename}`,
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
  const where = { status: 'approved' };

  // ... filters (price, state, city, brand, etc.)

  const { count, rows } = await Car.findAndCountAll({
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
      { model: User, attributes: ['id', 'full_name', 'phone'] },
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  return { total: count, cars: rows, page, limit, totalPages: Math.ceil(count / limit) };
};

exports.getCarById = async (carId) => {
  const car = await Car.findByPk(carId, {
    include: [
      { model: CarImage, as: 'images' },
      { model: User, attributes: ['id', 'full_name', 'phone', 'email', 'city', 'state'] },
    ],
  });
  if (!car) throw new AppError('Car not found.', 404);
  car.increment('views');
  return car;
};

exports.getUserCars = async (userId) => {
  return await Car.findAll({
    where: { dealer_id: userId },
    include: [{ model: CarImage, as: 'images' }],
    order: [['created_at', 'DESC']],
  });
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