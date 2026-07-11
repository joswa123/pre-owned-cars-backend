const locationService = require('../services/locationService');
const { catchAsync } = require('../utils/errorHandler');

// ✅ CORRECT – Get all states
exports.getStates = catchAsync(async (req, res) => {
  const states = await locationService.getStates();
  res.status(200).json({
    status: 'success',
    data: states,
  });
});

// ✅ CORRECT – Get cities by state ID
exports.getCitiesByState = catchAsync(async (req, res) => {
  const { stateId } = req.params;
  const cities = await locationService.getCitiesByState(stateId); // ← MUST be this!
  res.status(200).json({
    status: 'success',
    data: cities,
  });
});

// ✅ CORRECT – Get all cities
exports.getAllCities = catchAsync(async (req, res) => {
  const cities = await locationService.getAllCities();
  res.status(200).json({
    status: 'success',
    data: cities,
  });
});