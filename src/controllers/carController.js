const carService = require('../services/carService');
const { catchAsync } = require('../utils/errorHandler');

exports.createCar = catchAsync(async (req, res) => {
  // req.user is set by auth middleware
  const userId = req.user.id;
  const carData = req.body;
  const imageFiles = req.files || [];

  const car = await carService.createCar(userId, carData, imageFiles);

  res.status(200).json({
    status: 'success',
    message: 'Car listed successfully. Waiting for admin approval.',
    data: { car },
  });
});

exports.getCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, ...filters } = req.query;
  const result = await carService.getCars(filters, Number(page), Number(limit));

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

exports.getCarById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const car = await carService.getCarById(id);

  res.status(200).json({
    status: 'success',
    data: { car },
  });
});

exports.getUserCars = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cars = await carService.getUserCars(userId);

  res.status(200).json({
    status: 'success',
    data: { cars },
  });
});

exports.updateCar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updateData = req.body;

  const car = await carService.updateCar(id, userId, updateData);

  res.status(200).json({
    status: 'success',
    message: 'Car updated successfully.',
    data: { car },
  });
});

exports.deleteCar = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await carService.deleteCar(id, userId);

  res.status(200).json({
    status: 'success',
    message: 'Car deleted successfully.',
  });
});