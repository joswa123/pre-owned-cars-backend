// services/carService.js
const { Car, CarImage, User } = require("../models");
const { Op } = require("sequelize");
const { AppError } = require("../utils/errorHandler");
const sequelize = require("../config/database");
const { mapToDbValues } = require("../validations/carValidation");


// Helper to transform car images and make URLs absolute
const transformCarImages = (car, baseUrl = null) => {
  const images = car.images || [];
  const primary = images.find(img => img.is_primary === true);
  const secondary = images.filter(img => img.is_primary !== true);
  const base = baseUrl || process.env.BASE_URL || " https://repose-anthill-durably.ngrok-free.dev";

  const toAbsolute = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    // If it's a local path, prepend base URL
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
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
    if (!user) throw new AppError("User not found.", 404);

    // ─── Map Joi-normalised lowercase values → MySQL ENUM mixed-case ────────
    const mapped = mapToDbValues(carData);

    // ─── Car Fields ─────────────────────────────────────────────
    const carFields = {
      dealer_id: userId,
      brand: mapped.brand,
      model: mapped.model,
      variant: mapped.variant,
      year: mapped.year,
      purchase_date: mapped.purchasedate,
      number_plate: mapped.numplate,
      price: mapped.price,
      price_negotiable: mapped.price_negotiable || false,
      exterior_colour: mapped.exteriorColour,
      interior_colour: mapped.interiorColour,
      km_driven: mapped.kmdriven,
      fuel_type: mapped.fueltype,
      transmission: mapped.transmission,
      ownership: mapped.ownership,
      state: mapped.state,
      city: mapped.city,
      car_type: mapped.car_type,
      description: mapped.description || null,
      status: "pending",
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
      include: [{ model: CarImage, as: "images" }],
    });

    return createdCar;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// ─── Other Methods (unchanged) ──────────────────────────────

exports.getCars = async (filters = {}, page = 1, limit = 20, sortBy = "created_at", sortOrder = "DESC") => {
  const offset = (page - 1) * limit;
  const where = { status: "active" }; // Only show approved cars

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
      { model: CarImage, as: "images", attributes: ["id", "image_url", "is_primary"] },
      { model: User, attributes: ["id", "full_name", "phone", "profile_picture"] },
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  const baseUrl = process.env.BASE_URL || "https://pre-owned-cars-backend.onrender.com";
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
      { model: CarImage, as: "images", attributes: ["id", "image_url", "is_primary"] },
      { model: User, attributes: ["id", "full_name", "phone", "email", "city", "state", "profile_picture"] },
    ],
  });
  if (!car) throw new AppError("Car not found.", 404);

  // Increment views (async, don't wait)
  car.increment("views");

  const baseUrl = process.env.BASE_URL || "https://pre-owned-cars-backend.onrender.com";
  return transformCarImages(car, baseUrl);
};

exports.getUserCars = async (userId) => {
  const cars = await Car.findAll({
    where: { dealer_id: userId },
    include: [
      { model: CarImage, as: "images", attributes: ["id", "image_url", "is_primary"] },
    ],
    order: [["created_at", "DESC"]],
  });

  const baseUrl = process.env.BASE_URL || "https://pre-owned-cars-backend.onrender.com";
  return cars.map(car => transformCarImages(car, baseUrl));
};
exports.updateCar = async (carId, userId, updateData) => {
  const car = await Car.findOne({ where: { id: carId, dealer_id: userId } });
  if (!car) throw new AppError("Car not found or unauthorized.", 404);

  // Fields accepted for update (using DB column names)
  const allowedFields = [
    "brand", "model", "variant", "year", "purchase_date", "number_plate",
    "price", "exterior_colour", "interior_colour", "km_driven",
    "fuel_type", "transmission", "ownership", "state", "city", "description",
  ];

  // Map Joi-normalised (lowercase) values → MySQL ENUM mixed-case before filtering
  const mapped = mapToDbValues(updateData);

  const filteredData = {};
  allowedFields.forEach((field) => {
    if (mapped[field] !== undefined) filteredData[field] = mapped[field];
  });

  await car.update(filteredData);
  return car;
};

exports.deleteCar = async (carId, userId) => {
  const car = await Car.findOne({ where: { id: carId, dealer_id: userId } });
  if (!car) throw new AppError("Car not found or unauthorized.", 404);
  await CarImage.destroy({ where: { car_id: carId } });
  await car.destroy();
  return { success: true };
};

/**
 * Admin: Get all cars with filtering and pagination
 */
exports.getAdminCars = async (filters = {}, page = 1, limit = 20, sortBy = "created_at", sortOrder = "DESC", status = null) => {
  const offset = (page - 1) * limit;
  const where = {};

  if (status) {
    where.status = status;
  }

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
      { model: CarImage, as: "images", attributes: ["id", "image_url", "is_primary"] },
      { model: User, attributes: ["id", "full_name", "phone", "profile_picture"] },
    ],
    limit,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  const baseUrl = process.env.BASE_URL || " https://repose-anthill-durably.ngrok-free.dev";
  const transformedCars = rows.map(car => transformCarImages(car, baseUrl));

  return {
    total: count,
    cars: transformedCars,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * Get admin dashboard statistics
 * @returns {Promise<Object>} Stats object
 */
exports.getAdminStats = async () => {
    // Use Promise.all to run queries in parallel for better performance
    const [totalListings, pendingApprovals, approvedListings, rejectedListings] = await Promise.all([
        Car.count(), // Total cars
        Car.count({ where: { status: "pending" } }),
        Car.count({ where: { status: "active" } }), // Make sure this matches your DB ENUM
        Car.count({ where: { status: "rejected" } })
    ]);

    return {
        totalListings,
        pendingApprovals,
        approvedListings,
        rejectedListings
    };
};

/**
 * Admin: Update car status (approve, reject, activate, deactivate)
 * @param {string} carId - Car UUID
 * @param {string} status - 'active', 'inactive', 'sold'
 * @param {string} adminId - Admin user ID (for logging)
 */
exports.updateCarStatus = async (carId, status, adminId) => {
  console.log('🔍 updateCarStatus called with:', { carId, status });

  const validStatuses = ["active", "inactive", "sold", "pending"];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Status must be one of: ${validStatuses.join(", ")}`, 400);
  }

  // Use static Car.update() instead of instance .update() to avoid Sequelize
  // running full-model validation on other fields (e.g. ENUM fields that may
  // have stale / mismatched values on existing rows).
  const [affectedRows] = await Car.update(
    { status },
    { where: { id: carId }, validate: false }
  );

  if (affectedRows === 0) {
    throw new AppError("Car not found or status unchanged.", 404);
  }

  // Re-fetch the updated car to return fresh data
  const updatedCar = await Car.findByPk(carId);
  console.log('✅ Car status updated to:', updatedCar.status);
  return updatedCar;
};
/**
 * Toggle featured status of a car (admin only)
 */
exports.toggleFeatured = async (carId, is_featured) => {
  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found', 404);
  await car.update({ is_featured });
  return car;
};

/**
 * Get featured cars (public) – only active ones
 */
exports.getFeaturedCars = async (limit = 10) => {
  const cars = await Car.findAll({
    where: { status: 'active', is_featured: true },
    include: [
      { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
      { model: User, attributes: ['id', 'full_name', 'phone', 'profile_picture'] },
    ],
    order: [['created_at', 'DESC']],
    limit,
  });
  return cars;
};