const locationService = require('../services/locationService');
const { catchAsync } = require('../utils/errorHandler');

// Get all states
exports.getStates = catchAsync(async (req, res) => {
  const states = await locationService.getStates();
  res.status(200).json({
    status: 'success',
    data: states,
  });
});

// Get districts by state ID
exports.getDistrictsByState = catchAsync(async (req, res) => {
  const { stateId } = req.params;
  const districts = await locationService.getDistrictsByState(stateId);
  res.status(200).json({
    status: 'success',
    data: districts,
  });
});

// Get cities by district ID
exports.getCitiesByDistrict = catchAsync(async (req, res) => {
  const { districtId } = req.params;
  const cities = await locationService.getCitiesByDistrict(districtId);
  res.status(200).json({
    status: 'success',
    data: cities,
  });
});

// Get cities by state ID
exports.getCitiesByState = catchAsync(async (req, res) => {
  const { stateId } = req.params;
  const cities = await locationService.getCitiesByState(stateId);
  res.status(200).json({
    status: 'success',
    data: cities,
  });
});

// Get all cities
exports.getAllCities = catchAsync(async (req, res) => {
  const cities = await locationService.getAllCities();
  res.status(200).json({
    status: 'success',
    data: cities,
  });
});