const { Car, CarImage, User } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');

/**
 * Create a car listing and update user profile
 */
exports.createCar = async (userId, carData, imageFiles = []) => {
  const transaction = await sequelize.transaction();

  try {
    // 1. Update user profile with seller details (if provided)
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found.', 404);

    // Map profile fields from carData (only if they exist)
    const profileFields = [
      'name', 'email', 'phone', 'address', 'city', 'state', 'pincode',
      'aadhaar', 'companyname', 'licenseno', 'gstno', 'contactperson',
    ];
    const updateData = {};
    profileFields.forEach((field) => {
      if (carData[field] !== undefined && carData[field] !== null && carData[field] !== '') {
        // Map frontend field names to DB column names
        const dbFieldMap = {
          name: 'full_name',
          companyname: 'company_name',
          licenseno: 'license_no',
          gstno: 'gst_no',
          contactperson: 'contact_person',
        };
        const dbField = dbFieldMap[field] || field;
        updateData[dbField] = carData[field];
      }
    });

    // If the user role is not set, we could set it based on seller type
    // We'll assume the user already has the correct role.

    if (Object.keys(updateData).length > 0) {
      await user.update(updateData, { transaction });
    }

    // 2. Create car entry
    const carFields = {
      dealer_id: userId,
      brand: carData.brand,
      model: carData.model,
      variant: carData.variant,
      year: carData.year,
      purchase_date: carData.purchasedate,
      number_plate: carData.numplate,
      price: carData.price,
      exterior_colour: carData.exteriorColour,
      interior_colour: carData.interiorColour,
      km_driven: carData.kmdriven,
      fuel_type: carData.fueltype,
      transmission: carData.transmission,
      ownership: carData.ownership,
      location: carData.location,
      description: carData.description || null,
      status: 'pending', // admin approval
    };

    const car = await Car.create(carFields, { transaction });

    // 3. Save images
    if (imageFiles.length > 0) {
      const imageRecords = imageFiles.map((file, index) => ({
        car_id: car.id,
        image_url: `/uploads/${file.filename}`,
        is_primary: index === 0,
      }));
      await CarImage.bulkCreate(imageRecords, { transaction });
    }

    await transaction.commit();

    // Fetch the created car with images
    const createdCar = await Car.findByPk(car.id, {
      include: [{ model: CarImage, as: 'images' }],
    });

    return createdCar;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get cars with filters, pagination, sorting
 */
exports.getCars = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const where = { status: 'approved' }; // Only show approved cars

  // Apply filters
  if (filters.city) where.location = { [Op.like]: `%${filters.city}%` };
  if (filters.brand) where.brand = filters.brand;
  if (filters.model) where.model = { [Op.like]: `%${filters.model}%` };
  if (filters.fuel_type) where.fuel_type = filters.fuel_type;
  if (filters.transmission) where.transmission = filters.transmission;
  if (filters.min_price) where.price = { [Op.gte]: filters.min_price };
  if (filters.max_price) where.price = { ...where.price, [Op.lte]: filters.max_price };
  if (filters.year) where.year = filters.year;

  const { count, rows } = await Car.findAndCountAll({
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
      { model: User, attributes: ['id', 'full_name', 'phone'] },
    ],
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return { total: count, cars: rows, page, limit };
};

/**
 * Get a single car by ID
 */
exports.getCarById = async (carId) => {
  const car = await Car.findByPk(carId, {
    include: [
      { model: CarImage, as: 'images' },
      { model: User, attributes: ['id', 'full_name', 'phone', 'email', 'city', 'state'] },
    ],
  });
  if (!car) throw new AppError('Car not found.', 404);

  // Increment views (async, don't wait)
  car.increment('views');

  return car;
};

/**
 * Get user's own cars
 */
exports.getUserCars = async (userId) => {
  return await Car.findAll({
    where: { dealer_id: userId },
    include: [{ model: CarImage, as: 'images' }],
    order: [['created_at', 'DESC']],
  });
};

/**
 * Update car
 */
exports.updateCar = async (carId, userId, updateData) => {
  const car = await Car.findOne({ where: { id: carId, dealer_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  // Update only allowed fields
  const allowedFields = [
    'brand', 'model', 'variant', 'year', 'purchase_date', 'number_plate',
    'price', 'exterior_colour', 'interior_colour', 'km_driven',
    'fuel_type', 'transmission', 'ownership', 'location', 'description',
  ];
  const filteredData = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) filteredData[field] = updateData[field];
  });

  await car.update(filteredData);
  return car;
};

/**
 * Delete car
 */
exports.deleteCar = async (carId, userId) => {
  const car = await Car.findOne({ where: { id: carId, dealer_id: userId } });
  if (!car) throw new AppError('Car not found or unauthorized.', 404);

  // Delete associated images (physical files could be removed too)
  await CarImage.destroy({ where: { car_id: carId } });
  await car.destroy();
  return { success: true };
};