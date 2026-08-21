const locationService = require('../services/locationService');
const { catchAsync } = require('../utils/errorHandler');
const { State, District, City, User, DealerProfile, Car, CarImage, Brand, Model, Variant } = require('../models');
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
    const { state_id, district_id, city_id, company_name, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = { role: 'dealer' };
    
    if (state_id) where.state_id = state_id;
    if (district_id) where.district_id = district_id;
    if (city_id) where.city_id = city_id;

    const include = [{
      model: DealerProfile,
      as: 'dealerProfile',
      attributes: ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'verified'],
    }];

    if (company_name) {
      include[0].where = { company_name: { [Op.like]: `%${company_name}%` } };
    }

    const dealers = await User.findAndCountAll({
      where,
      attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture', 'state_id', 'district_id', 'city_id'],
      include: [
        ...include,
        { model: State, as: 'stateDetail', attributes: ['name'] },
        { model: District, as: 'districtDetail', attributes: ['name'] },
        { model: City, as: 'cityDetail', attributes: ['name'] },
      ],
      limit: parseInt(limit),
      offset,
      order: [['full_name', 'ASC']],
    });

    res.json({
      status: 'success',
      data: dealers.rows,
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total: dealers.count, 
        totalPages: Math.ceil(dealers.count / limit) 
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get single dealer profile
exports.getDealerProfile = async (req, res, next) => {
  try {
    const { dealerId } = req.params;
    const cacheKey = `dealer:${dealerId}`;
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ status: 'success', data: JSON.parse(cached) });
      }
    }

    const dealer = await User.findOne({
      where: { id: dealerId, role: 'dealer' },
      attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture', 'whatsapp_number', 'use_registered_for_whatsapp'],
      include: [
        { model: DealerProfile, as: 'dealerProfile' },
        { model: State, as: 'stateDetail', attributes: ['id', 'name'] },
        { model: District, as: 'districtDetail', attributes: ['id', 'name'] },
        { model: City, as: 'cityDetail', attributes: ['id', 'name'] },
        {
          model: Car,
          as: 'postedCars',
          limit: 20,
          order: [['created_at', 'DESC']],
          where: { status: 'active' },
          required: false,
          include: [
            { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
            { model: Brand, as: 'brand', attributes: ['id', 'name'] },
            { model: Model, as: 'carModel', attributes: ['id', 'name'] },
            { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
            { model: State, as: 'state', attributes: ['name'] },
            { model: District, as: 'district', attributes: ['name'] },
            { model: City, as: 'city', attributes: ['name'] },
          ],
        },
      ],
    });

    if (!dealer) {
      return res.status(404).json({ status: 'error', message: 'Dealer not found' });
    }

    const dealerJson = dealer.toJSON();
    dealerJson.location_text = [dealerJson.cityDetail?.name, dealerJson.districtDetail?.name, dealerJson.stateDetail?.name].filter(Boolean).join(', ');

    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(dealerJson)); // 5 min
    }
    res.json({ status: 'success', data: dealerJson });
  } catch (error) {
    next(error);
  }
};