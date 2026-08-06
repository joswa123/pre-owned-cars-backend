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
    message: "Car listed successfully.",
    data: { car },
  });
});

/**
 * Get Public Cars List with Filters
 */
exports.getCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sortBy = "created_at", sortOrder = "DESC", ...filters } = req.query;
  const userId = req.user?.id;
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
 * Get Cars Posted by Current Logged-in User
 */
exports.getUserCars = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query; // Allow filtering by status (e.g. ?status=active)
  
  const cars = await carService.getUserCars(userId, status);

  res.status(200).json({
    status: "success",
    data: { cars },
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