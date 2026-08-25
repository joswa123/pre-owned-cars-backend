const carService = require("../services/carService");
const { catchAsync } = require("../utils/errorHandler");

/**
 * Create Car Listing
 */
exports.createCar = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const carData = req.body;
  const files = req.files;

  const car = await carService.createCar(userId, carData, files);

  // Clear cache
  const { clearCache } = require('../middlewares/cacheMiddleware');
  clearCache('/api/v1/cars');

  res.status(200).json({
    status: "success",
    success: true,
    message: "Car listed successfully.",
    data: {
      car,
      ...car,
    },
  });
});

/**
 * Get Public Cars List with Filters
 */
exports.getCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sortBy = "created_at", sortOrder = "DESC", ...rawFilters } = req.query;
  const userId = req.user?.id;

  const filters = { ...rawFilters };

  // Parse arrays
  const arrayFields = ['brands', 'models', 'fuel_types', 'body_types', 'ownerships', 'transmissions'];
  arrayFields.forEach(field => {
    if (filters[field] && typeof filters[field] === 'string') {
      filters[field] = filters[field].split(',').map(item => item.trim()).filter(Boolean);
    }
  });

  // Parse booleans
  if (filters.include_expired !== undefined) {
    filters.include_expired = filters.include_expired === 'true';
  }

  const result = await carService.getCars(filters, Number(page), Number(limit), sortBy, sortOrder, userId);
  res.status(200).json({ status: "success", data: result });
});

/**
 * Get Car By ID
 */
exports.getCarById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const car = await carService.getCarById(id, userId);

  res.status(200).json({
    status: "success",
    data: { car },
  });
});

/**
 * Get Featured Cars
 */
exports.getFeaturedCars = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  const userId = req.user?.id;
  const cars = await carService.getFeaturedCars(Number(limit), userId);
  res.status(200).json({ status: "success", data: { cars } });
});

/**
 * Get Cars Posted by Current Logged-in User (with real-time metrics & cursor pagination)
 */
exports.getUserCars = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { status, page, limit, cursor } = req.query;
  
  const result = await carService.getUserCars(userId, { status, page, limit, cursor });
  const cars = result.cars || result;

  res.status(200).json({
    status: "success",
    data: { 
      cars,
      pagination: result.pagination,
    },
  });
});

/**
 * Update Car Listing
 */
exports.updateCar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updateData = req.body;
  const files = req.files;

  const car = await carService.updateCar(id, userId, updateData, files);

  const { clearCache } = require('../middlewares/cacheMiddleware');
  clearCache('/api/v1/cars');

  res.status(200).json({
    status: "success",
    message: "Car updated successfully.",
    data: { car },
  });
});

/**
 * Delete Car Image
 */
exports.deleteCarImage = catchAsync(async (req, res) => {
  const { id, imageId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  await carService.deleteCarImage(userId, id, imageId, userRole);

  const { clearCache } = require('../middlewares/cacheMiddleware');
  clearCache('/api/v1/cars');

  res.status(200).json({
    status: "success",
    message: "Image deleted successfully",
  });
});

/**
 * Mark Car as Sold
 */
exports.markCarAsSold = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedCar = await carService.markCarAsSold(id, req.user.id, req.user.role);

  res.status(200).json({
    status: 'success',
    message: 'Car marked as sold successfully.',
    data: { car: updatedCar },
  });
});

/**
 * Delete Car Listing
 */
exports.deleteCar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await carService.deleteCar(id, userId);

  const { clearCache } = require('../middlewares/cacheMiddleware');
  clearCache('/api/v1/cars');

  res.status(200).json({
    status: "success",
    message: "Car deleted successfully.",
  });
});

/**
 * Admin: Get All Cars
 */
exports.getAdminCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sortBy = "created_at", sortOrder = "DESC", ...filters } = req.query;
  const result = await carService.getAdminCars(filters, Number(page), Number(limit), sortBy, sortOrder);
  res.status(200).json({ status: "success", data: result });
});

/**
 * Admin Dashboard Stats
 */
exports.getAdminStats = catchAsync(async (req, res) => {
  const stats = await carService.getAdminStats();
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Admin: Update Car Status
 */
exports.updateCarStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const car = await carService.updateCarStatus(id, status, req.user.id);
  res.status(200).json({ success: true, message: `Car status updated successfully.`, data: { car } });
});

/**
 * Admin: Toggle Featured
 */
exports.toggleFeatured = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { is_featured } = req.body;
  const car = await carService.toggleFeatured(id, is_featured);
  res.status(200).json({
    success: true,
    message: `Car featured status updated successfully.`,
    data: { car },
  });
});

/**
 * Get Board Type Stats
 */
exports.getBoardTypeStats = catchAsync(async (req, res) => {
  const stats = await carService.getBoardTypeStats();
  res.status(200).json({ status: 'success', data: stats });
});

/**
 * Record Car View (Legacy & Direct)
 */
exports.recordView = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user ? req.user.id : null;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  
  await carService.recordView(id, userId, ipAddress);

  res.status(200).json({
    status: 'success',
    message: 'View recorded successfully.',
  });
});

/**
 * Record Customer Interaction (View, Call, WhatsApp, Message, Enquiry, Wishlist)
 */
exports.recordInteraction = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { type = 'view' } = req.body;
  const userId = req.user ? req.user.id : null;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

  if (type === 'view') {
    await carService.recordView(id, userId, ipAddress);
  } else {
    const analyticsService = require('../services/analyticsService');
    await analyticsService.recordInteraction({ carId: id, userId, type, ipAddress });
  }

  res.status(200).json({
    status: 'success',
    message: `${type} interaction recorded successfully.`,
  });
});

/**
 * Get Similar and Recommended Cars
 */
exports.getSimilarRecommended = catchAsync(async (req, res) => {
  const { carId, userId, limit = 4, page = 1 } = req.query;
  const currentUserId = userId || (req.user ? req.user.id : null);
  
  if (!carId) {
    return res.status(400).json({ status: 'fail', message: 'carId is required' });
  }

  const result = await carService.getSimilarRecommended(carId, currentUserId, Number(limit), Number(page));

  res.status(200).json({
    status: 'success',
    data: result
  });
});