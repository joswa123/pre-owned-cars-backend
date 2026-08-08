const locationService = require('../services/locationService');
const { catchAsync } = require('../utils/errorHandler');
const { State, District, City, User, DealerProfile } = require('../models');
const { Op } = require('sequelize');
const redisClient = require('../config/redis');

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

// Force seed location data (States, Districts, Cities)
exports.seedLocations = catchAsync(async (req, res) => {
  const seedLocationsUtil = require('../utils/seedLocations');
  await seedLocationsUtil(true);
  res.status(200).json({
    status: 'success',
    message: 'Locations seeded successfully (States, Districts, Cities)',
  });
});

// 1. Full hierarchy (cached)
exports.getFullHierarchy = async (req, res, next) => {
  try {
    const cacheKey = 'locations:hierarchy';
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({ status: 'success', data: JSON.parse(cached) });
    }

    const states = await State.findAll({
      attributes: ['id', 'name'],
      include: [{
        model: District,
        as: 'districts',
        attributes: ['id', 'name'],
        include: [{
          model: City,
          as: 'cities',
          attributes: ['id', 'name'],
        }],
      }],
    });

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(states)); // 1 hour
    res.json({ status: 'success', data: states });
  } catch (error) {
    next(error);
  }
};

// 2. Get dealers by location filters
exports.getDealersByLocation = async (req, res, next) => {
  try {
    const { state_id, district_id, city_id } = req.query;
    const where = {};
    if (state_id) where.state_id = state_id;
    if (district_id) where.district_id = district_id;
    if (city_id) where.city_id = city_id;
    // Only dealers
    where.role = 'dealer';

    const dealers = await User.findAll({
      where,
      attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture'],
      include: [{
        model: DealerProfile,
        as: 'dealerProfile',
        attributes: ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'verified'],
      }],
    });

    res.json({ status: 'success', data: dealers });
  } catch (error) {
    next(error);
  }
};

// 3. Get single dealer profile
exports.getDealerProfile = async (req, res, next) => {
  try {
    const { dealerId } = req.params;
    const cacheKey = `dealer:${dealerId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({ status: 'success', data: JSON.parse(cached) });
    }

    const dealer = await User.findOne({
      where: { id: dealerId, role: 'dealer' },
      attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture'],
      include: [
        { model: DealerProfile, as: 'dealerProfile' },
        { model: State, as: 'stateDetail', attributes: ['id', 'name'] },
        { model: District, as: 'districtDetail', attributes: ['id', 'name'] },
        { model: City, as: 'cityDetail', attributes: ['id', 'name'] },
      ],
    });

    if (!dealer) {
      return res.status(404).json({ status: 'error', message: 'Dealer not found' });
    }

    await redisClient.setEx(cacheKey, 300, JSON.stringify(dealer)); // 5 min
    res.json({ status: 'success', data: dealer });
  } catch (error) {
    next(error);
  }
};