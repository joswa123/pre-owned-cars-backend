// controllers/carController.js
const carService = require("../services/carService");
const { catchAsync } = require("../utils/errorHandler");

exports.createCar = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const carData = req.body;
  const files = req.files; // { primary_image: [file], images: [file] }

  const car = await carService.createCar(userId, carData, files);

  res.status(200).json({
    status: "success",
    message: "Car listed successfully. Waiting for admin approval.",
    data: { car },
  });
});

// ... other methods

exports.getCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sortBy = "created_at", sortOrder = "DESC", ...filters } = req.query;
  const result = await carService.getCars(filters, Number(page), Number(limit), sortBy, sortOrder);
  res.status(200).json({ status: "success", data: result });
});
exports.getCarById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const car = await carService.getCarById(id);

  res.status(200).json({
    status: "success",
    data: { car },
  });
});

exports.getUserCars = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cars = await carService.getUserCars(userId);

  res.status(200).json({
    status: "success",
    data: { cars },
  });
});

exports.updateCar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updateData = req.body;

  const car = await carService.updateCar(id, userId, updateData);

  res.status(200).json({
    status: "success",
    message: "Car updated successfully.",
    data: { car },
  });
});

exports.deleteCar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await carService.deleteCar(id, userId);

  res.status(200).json({
    status: "success",
    message: "Car deleted successfully.",
  });
});

exports.getAdminCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, sortBy = "created_at", sortOrder = "DESC", ...filters } = req.query;
  const result = await carService.getAdminCars(filters, Number(page), Number(limit), sortBy, sortOrder, status);
  res.status(200).json({ status: "success", data: result });
});

/**
 * Get admin dashboard stats
 */
exports.getAdminStats = catchAsync(async (req, res) => {
    const stats = await carService.getAdminStats();
    res.status(200).json({
        success: true,
        data: stats
    });
});

/**
 * Admin – Update car status (approve/reject)
 * PUT /admin/cars/:id/status
 */
exports.updateCarStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate that status is provided
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const car = await carService.updateCarStatus(id, status, req.user.id);
  res.status(200).json({ success: true, message: `Car status updated to "${status}" successfully.`, data: { car } });
});


/**
 * Admin toggle featured
 */
exports.toggleFeatured = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { is_featured } = req.body; // expects boolean
  if (typeof is_featured !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_featured must be a boolean' });
  }
  const car = await carService.toggleFeatured(id, is_featured);
  res.status(200).json({
    success: true,
    message: `Car featured status updated to ${is_featured}`,
    data: { car },
  });
});

/**
 * Public get featured cars
 */
exports.getFeaturedCars = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  const cars = await carService.getFeaturedCars(Number(limit));
  res.status(200).json({ success: true, data: { cars } });
});