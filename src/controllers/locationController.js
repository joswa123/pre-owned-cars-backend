const locationService = require('../services/locationService');
const { catchAsync } = require('../utils/errorHandler');
const {
  State,
  District,
  City,
  User,
  DealerProfile,
  Car,
  CarImage,
  Brand,
  Model,
  Variant,
  CommercialVehicle,
  CommercialVehicleImage,
  CarType,
} = require('../models');
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

    // 1. Intelligent Location Hierarchy Resolution
    if (city_id && String(city_id).trim() !== '') {
      const trimmedCityId = String(city_id).trim();
      const selectedCity = await City.findByPk(trimmedCityId, {
        include: [{ model: District, as: 'district' }],
      });

      if (selectedCity) {
        const districtName = selectedCity.district?.name?.toLowerCase();
        const cityName = selectedCity.name?.toLowerCase();
        const isMajorCityDistrict = districtName && cityName && (
          districtName === cityName ||
          districtName.includes(cityName) ||
          cityName.includes(districtName)
        );

        if (isMajorCityDistrict && selectedCity.district_id) {
          // Major hub (e.g. Coimbatore, Madurai): match dealers in city, district, or any locality under district
          const districtCities = await City.findAll({
            where: { district_id: selectedCity.district_id },
            attributes: ['id'],
            raw: true,
          });
          const cityIdsInDistrict = districtCities.map((c) => c.id);

          where[Op.and] = where[Op.and] || [];
          where[Op.and].push({
            [Op.or]: [
              { city_id: selectedCity.id },
              { district_id: selectedCity.district_id },
              ...(cityIdsInDistrict.length > 0 ? [{ city_id: cityIdsInDistrict }] : []),
              { city: { [Op.like]: `%${selectedCity.name}%` } },
            ],
          });
        } else {
          where[Op.and] = where[Op.and] || [];
          where[Op.and].push({
            [Op.or]: [
              { city_id: selectedCity.id },
              { city: { [Op.like]: `%${selectedCity.name}%` } },
            ],
          });
        }
      } else {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [
            { city_id: trimmedCityId },
            { city: { [Op.like]: `%${trimmedCityId}%` } },
          ],
        });
      }
    } else if (district_id && String(district_id).trim() !== '') {
      const trimmedDistrictId = String(district_id).trim();
      const districtCities = await City.findAll({
        where: { district_id: trimmedDistrictId },
        attributes: ['id'],
        raw: true,
      });
      const cityIdsInDistrict = districtCities.map((c) => c.id);

      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { district_id: trimmedDistrictId },
          ...(cityIdsInDistrict.length > 0 ? [{ city_id: cityIdsInDistrict }] : []),
        ],
      });
    }

    if (state_id && String(state_id).trim() !== '') {
      const trimmedStateId = String(state_id).trim();
      const stateCities = await City.findAll({
        where: { state_id: trimmedStateId },
        attributes: ['id'],
        raw: true,
      });
      const cityIdsInState = stateCities.map((c) => c.id);

      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { state_id: trimmedStateId },
          ...(cityIdsInState.length > 0 ? [{ city_id: cityIdsInState }] : []),
        ],
      });
    }

    // 2. Search by company name or dealer full name
    if (company_name && String(company_name).trim() !== '') {
      const search = `%${String(company_name).trim()}%`;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { full_name: { [Op.like]: search } },
          { '$dealerProfile.company_name$': { [Op.like]: search } },
        ],
      });
    }

    const dealers = await User.findAndCountAll({
      where,
      subQuery: false,
      distinct: true,
      attributes: [
        'id',
        'full_name',
        'phone',
        'email',
        'profile_picture',
        'state_id',
        'district_id',
        'city_id',
        'city',
        'state',
        'whatsapp_number',
        'use_registered_for_whatsapp',
        'role',
        'status',
      ],
      include: [
        {
          model: DealerProfile,
          as: 'dealerProfile',
          attributes: ['id', 'company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'verified'],
          required: false,
        },
        { model: State, as: 'stateDetail', attributes: ['id', 'name'] },
        { model: District, as: 'districtDetail', attributes: ['id', 'name'] },
        {
          model: City,
          as: 'cityDetail',
          attributes: ['id', 'name'],
          include: [
            {
              model: District,
              as: 'district',
              attributes: ['id', 'name'],
              include: [{ model: State, as: 'state', attributes: ['id', 'name', 'code'] }],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [['full_name', 'ASC']],
    });

    const transformedDealers = dealers.rows.map((dealer) => {
      const d = dealer.toJSON ? dealer.toJSON() : { ...dealer };
      const fallbackDistrict = d.districtDetail || d.cityDetail?.district || null;
      const fallbackState = d.stateDetail || d.cityDetail?.district?.state || null;

      const cityDetail = d.cityDetail ? {
        id: d.cityDetail.id,
        name: d.cityDetail.name,
      } : {
        id: d.city_id || null,
        name: d.city || '',
      };
      const districtDetail = fallbackDistrict ? {
        id: fallbackDistrict.id,
        name: fallbackDistrict.name,
      } : {
        id: d.district_id || null,
        name: d.district || '',
      };
      const stateDetail = fallbackState ? {
        id: fallbackState.id,
        name: fallbackState.name,
      } : {
        id: d.state_id || null,
        name: d.state || '',
      };
      const dealerProfile = d.dealerProfile || {
        id: null,
        user_id: d.id,
        company_name: d.full_name || 'Dealer',
        door_no: '',
        building_name: '',
        street_name: '',
        pincode: '',
        alt_phone: null,
        verified: false,
      };

      const showroomLocation = {
        showroom_name: dealerProfile.company_name || d.full_name || 'Dealer',
        door_no: dealerProfile.door_no || '',
        building_name: dealerProfile.building_name || '',
        street_name: dealerProfile.street_name || '',
        pincode: dealerProfile.pincode || '',
        city: cityDetail.name || '',
        city_id: cityDetail.id || null,
        district: districtDetail.name || '',
        district_id: districtDetail.id || null,
        state: stateDetail.name || '',
        state_id: stateDetail.id || null,
        address_text: [dealerProfile.door_no, dealerProfile.building_name, dealerProfile.street_name, cityDetail.name, districtDetail.name, stateDetail.name, dealerProfile.pincode].filter(Boolean).join(', '),
      };

      d.cityDetail = cityDetail;
      d.districtDetail = districtDetail;
      d.stateDetail = stateDetail;
      d.dealerProfile = dealerProfile;
      d.location_text = [cityDetail.name, districtDetail.name, stateDetail.name].filter(Boolean).join(', ');
      d.showroom_location = showroomLocation;

      return d;
    });

    res.json({
      status: 'success',
      data: transformedDealers,
      dealers: transformedDealers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: dealers.count,
        totalPages: Math.ceil(dealers.count / limit) || 1,
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
    const typeParam = (req.query.type || 'all').toLowerCase();
    const cacheKey = typeParam === 'all' ? `dealer:${dealerId}` : `dealer:${dealerId}:${typeParam}`;

    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ status: 'success', data: JSON.parse(cached) });
      }
    }

    const dealer = await User.findOne({
      where: { id: dealerId },
      attributes: [
        'id',
        'full_name',
        'phone',
        'email',
        'profile_picture',
        'whatsapp_number',
        'use_registered_for_whatsapp',
        'city',
        'state',
        'district_id',
        'city_id',
        'state_id',
        'role',
      ],
      include: [
        { model: DealerProfile, as: 'dealerProfile' },
        { model: State, as: 'stateDetail', attributes: ['id', 'name'] },
        { model: District, as: 'districtDetail', attributes: ['id', 'name'] },
        {
          model: City,
          as: 'cityDetail',
          attributes: ['id', 'name'],
          include: [
            {
              model: District,
              as: 'district',
              attributes: ['id', 'name'],
              include: [{ model: State, as: 'state', attributes: ['id', 'name', 'code'] }],
            },
          ],
        },
      ],
    });

    if (!dealer) {
      return res.status(404).json({ status: 'error', message: 'Dealer not found' });
    }

    // Performance constraint: If type === 'car' or type === 'commercial', bypass the other query entirely!
    const carLimit = typeParam === 'commercial' ? 0 : (typeParam === 'car' ? 20 : 10);
    const commercialLimit = typeParam === 'car' ? 0 : (typeParam === 'commercial' ? 20 : 10);

    const [rawCars, rawCommercial, carCount, commercialCount] = await Promise.all([
      carLimit > 0
        ? Car.findAll({
            where: { user_id: dealerId, status: 'active' },
            limit: carLimit,
            order: [['created_at', 'DESC']],
            include: [
              { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
              { model: Brand, as: 'brand', attributes: ['id', 'name'] },
              { model: Model, as: 'carModel', attributes: ['id', 'name'] },
              { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
              { model: State, as: 'state', attributes: ['name'] },
              { model: District, as: 'district', attributes: ['name'] },
              { model: City, as: 'city', attributes: ['name'] },
            ],
          })
        : Promise.resolve([]),
      commercialLimit > 0
        ? CommercialVehicle.findAll({
            where: { user_id: dealerId, status: 'active' },
            limit: commercialLimit,
            order: [['created_at', 'DESC']],
            include: [
              { model: CommercialVehicleImage, as: 'images', attributes: ['id', 'image_url', 'is_primary', 'sort_order'] },
              { model: Brand, as: 'brand', attributes: ['id', 'name'] },
              { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
              { model: State, as: 'state', attributes: ['name'] },
              { model: District, as: 'district', attributes: ['name'] },
              { model: City, as: 'city', attributes: ['name'] },
            ],
          })
        : Promise.resolve([]),
      Car.count({ where: { user_id: dealerId, status: 'active' } }),
      CommercialVehicle.count({ where: { user_id: dealerId, status: 'active' } }),
    ]);

    const { transformCarImages } = require('../services/carService');
    const { transformCommercialVehicleImages } = require('../services/commercialVehicleService');
    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';

    const postedCars = rawCars.map((c) => {
      const json = c.toJSON ? c.toJSON() : c;
      const transformed = transformCarImages(json, baseUrl);
      transformed.target_type = 'car';
      transformed.listing_location = {
        city: json.city?.name || json.city || null,
        city_id: json.city_id || null,
        district: json.district?.name || json.district || null,
        district_id: json.district_id || null,
        state: json.state?.name || json.state || null,
        state_id: json.state_id || null,
        location_text: [json.city?.name || json.city, json.district?.name || json.district, json.state?.name || json.state].filter(Boolean).join(', '),
      };
      return transformed;
    });

    const postedCommercial = rawCommercial.map((cv) => {
      const json = cv.toJSON ? cv.toJSON() : cv;
      const transformed = transformCommercialVehicleImages(json, baseUrl);
      transformed.target_type = 'commercial';
      transformed.listing_location = {
        city: json.city?.name || null,
        city_id: json.city_id || null,
        district: json.district?.name || null,
        district_id: json.district_id || null,
        state: json.state?.name || null,
        state_id: json.state_id || null,
        location_text: [json.city?.name, json.district?.name, json.state?.name].filter(Boolean).join(', '),
      };
      return transformed;
    });

    // Merge, sort by created_at DESC, and slice top 20
    const mergedVehicles = [...postedCars, ...postedCommercial]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 20);

    const dealerJson = dealer.toJSON();
    const fallbackDistrict = dealerJson.districtDetail || dealerJson.cityDetail?.district || null;
    const fallbackState = dealerJson.stateDetail || dealerJson.cityDetail?.district?.state || null;

    const cityDetail = dealerJson.cityDetail ? {
      id: dealerJson.cityDetail.id,
      name: dealerJson.cityDetail.name,
    } : {
      id: dealerJson.city_id || null,
      name: dealerJson.city || '',
    };
    const districtDetail = fallbackDistrict ? {
      id: fallbackDistrict.id,
      name: fallbackDistrict.name,
    } : {
      id: dealerJson.district_id || null,
      name: dealerJson.district || '',
    };
    const stateDetail = fallbackState ? {
      id: fallbackState.id,
      name: fallbackState.name,
    } : {
      id: dealerJson.state_id || null,
      name: dealerJson.state || '',
    };
    const dealerProfile = dealerJson.dealerProfile || {
      id: null,
      user_id: dealerJson.id,
      company_name: dealerJson.full_name || 'Seller',
      door_no: '',
      building_name: '',
      street_name: '',
      pincode: '',
      alt_phone: null,
      verified: false,
    };

    const showroomLocation = {
      showroom_name: dealerProfile.company_name || dealerJson.full_name || 'Dealer',
      door_no: dealerProfile.door_no || '',
      building_name: dealerProfile.building_name || '',
      street_name: dealerProfile.street_name || '',
      pincode: dealerProfile.pincode || '',
      city: cityDetail.name || '',
      city_id: cityDetail.id || null,
      district: districtDetail.name || '',
      district_id: districtDetail.id || null,
      state: stateDetail.name || '',
      state_id: stateDetail.id || null,
      address_text: [dealerProfile.door_no, dealerProfile.building_name, dealerProfile.street_name, cityDetail.name, districtDetail.name, stateDetail.name, dealerProfile.pincode].filter(Boolean).join(', '),
    };

    dealerJson.cityDetail = cityDetail;
    dealerJson.districtDetail = districtDetail;
    dealerJson.stateDetail = stateDetail;
    dealerJson.dealerProfile = dealerProfile;
    dealerJson.location_text = [cityDetail.name, districtDetail.name, stateDetail.name].filter(Boolean).join(', ');
    dealerJson.showroom_location = showroomLocation;
    dealerJson.inventory_counts = {
      cars: carCount,
      commercial: commercialCount,
      total: carCount + commercialCount,
    };
    dealerJson.postedCars = postedCars;
    dealerJson.postedCommercialVehicles = postedCommercial;
    dealerJson.commercialVehicles = postedCommercial; // alias
    dealerJson.postedVehicles = mergedVehicles;

    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(dealerJson)); // 5 min
    }
    res.json({ status: 'success', data: dealerJson });
  } catch (error) {
    next(error);
  }
};

// 4. Get dealer commercial vehicles (paginated)
exports.getDealerCommercialVehicles = async (req, res, next) => {
  try {
    const { dealerId } = req.params;
    const commercialVehicleService = require('../services/commercialVehicleService');
    const viewerUserId = req.user?.id || null;
    const viewerUserRole = req.user?.role || null;

    const dealer = await User.findOne({
      where: { id: dealerId },
      attributes: [
        'id',
        'full_name',
        'phone',
        'email',
        'profile_picture',
        'whatsapp_number',
        'use_registered_for_whatsapp',
        'city',
        'state',
        'district_id',
        'city_id',
        'state_id',
        'role',
      ],
      include: [
        { model: DealerProfile, as: 'dealerProfile' },
        { model: State, as: 'stateDetail', attributes: ['id', 'name'] },
        { model: District, as: 'districtDetail', attributes: ['id', 'name'] },
        {
          model: City,
          as: 'cityDetail',
          attributes: ['id', 'name'],
          include: [
            {
              model: District,
              as: 'district',
              attributes: ['id', 'name'],
              include: [{ model: State, as: 'state', attributes: ['id', 'name', 'code'] }],
            },
          ],
        },
      ],
    });

    if (!dealer) {
      return res.status(404).json({ status: 'error', message: 'Dealer not found' });
    }

    const fallbackDistrict = dealer.districtDetail || dealer.cityDetail?.district || null;
    const fallbackState = dealer.stateDetail || dealer.cityDetail?.district?.state || null;

    const cityDetail = dealer.cityDetail ? {
      id: dealer.cityDetail.id,
      name: dealer.cityDetail.name,
    } : {
      id: dealer.city_id || null,
      name: dealer.city || '',
    };
    const districtDetail = fallbackDistrict ? {
      id: fallbackDistrict.id,
      name: fallbackDistrict.name,
    } : {
      id: dealer.district_id || null,
      name: dealer.district || '',
    };
    const stateDetail = fallbackState ? {
      id: fallbackState.id,
      name: fallbackState.name,
    } : {
      id: dealer.state_id || null,
      name: dealer.state || '',
    };

    const dealerProfile = dealer.dealerProfile || {
      id: null,
      user_id: dealer.id,
      company_name: dealer.full_name || 'Seller',
      door_no: '',
      building_name: '',
      street_name: '',
      pincode: '',
      alt_phone: null,
      verified: false,
    };

    const locationText = [cityDetail.name, districtDetail.name, stateDetail.name].filter(Boolean).join(', ');

    const showroomLocation = {
      showroom_name: dealerProfile.company_name || dealer.full_name || 'Dealer',
      door_no: dealerProfile.door_no || '',
      building_name: dealerProfile.building_name || '',
      street_name: dealerProfile.street_name || '',
      pincode: dealerProfile.pincode || '',
      city: cityDetail.name || '',
      city_id: cityDetail.id || null,
      district: districtDetail.name || '',
      district_id: districtDetail.id || null,
      state: stateDetail.name || '',
      state_id: stateDetail.id || null,
      address_text: [dealerProfile.door_no, dealerProfile.building_name, dealerProfile.street_name, cityDetail.name, districtDetail.name, stateDetail.name, dealerProfile.pincode].filter(Boolean).join(', '),
    };

    const result = await commercialVehicleService.getCommercialVehicles(
      { ...req.query, dealer_id: dealerId },
      req.query.page || 1,
      req.query.limit || 20,
      req.query.sort_by || 'created_at',
      req.query.sort_order || 'DESC',
      viewerUserId,
      viewerUserRole
    );

    const total = result.pagination?.total !== undefined ? result.pagination.total : (result.total || result.vehicles?.length || 0);
    const page = result.pagination?.page || parseInt(req.query.page, 10) || 1;
    const limit = result.pagination?.limit || parseInt(req.query.limit, 10) || 20;
    const totalPages = result.pagination?.totalPages || Math.ceil(total / limit) || 1;
    const pagination = result.pagination || {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      status: 'success',
      data: {
        ...result,
        vehicles: result.vehicles || [],
        commercial: result.vehicles || [],
        cars: result.cars || result.vehicles || [],
        total,
        page,
        limit,
        totalPages,
        pagination,
        dealerProfile,
        cityDetail,
        districtDetail,
        stateDetail,
        location_text: locationText,
        showroom_location: showroomLocation,
        dealer: {
          id: dealer.id,
          full_name: dealer.full_name,
          phone: dealer.phone,
          email: dealer.email,
          profile_picture: dealer.profile_picture,
          whatsapp_number: dealer.whatsapp_number,
          use_registered_for_whatsapp: dealer.use_registered_for_whatsapp,
          role: dealer.role,
          dealerProfile,
          cityDetail,
          districtDetail,
          stateDetail,
          location_text: locationText,
          showroom_location: showroomLocation,
        },
        id: dealer.id,
        full_name: dealer.full_name,
        phone: dealer.phone,
        email: dealer.email,
        profile_picture: dealer.profile_picture,
        whatsapp_number: dealer.whatsapp_number,
        use_registered_for_whatsapp: dealer.use_registered_for_whatsapp,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get dealer cars (paginated)
exports.getDealerCars = async (req, res, next) => {
  try {
    const { dealerId } = req.params;
    const dealerService = require('../services/dealerService');
    const viewerUserId = req.user?.id || null;

    const dealer = await User.findOne({
      where: { id: dealerId },
      attributes: [
        'id',
        'full_name',
        'phone',
        'email',
        'profile_picture',
        'whatsapp_number',
        'use_registered_for_whatsapp',
        'city',
        'state',
        'district_id',
        'city_id',
        'state_id',
        'role',
      ],
      include: [
        { model: DealerProfile, as: 'dealerProfile' },
        { model: State, as: 'stateDetail', attributes: ['id', 'name'] },
        { model: District, as: 'districtDetail', attributes: ['id', 'name'] },
        {
          model: City,
          as: 'cityDetail',
          attributes: ['id', 'name'],
          include: [
            {
              model: District,
              as: 'district',
              attributes: ['id', 'name'],
              include: [{ model: State, as: 'state', attributes: ['id', 'name', 'code'] }],
            },
          ],
        },
      ],
    });

    if (!dealer) {
      return res.status(404).json({ status: 'error', message: 'Dealer not found' });
    }

    const fallbackDistrict = dealer.districtDetail || dealer.cityDetail?.district || null;
    const fallbackState = dealer.stateDetail || dealer.cityDetail?.district?.state || null;

    const cityDetail = dealer.cityDetail ? {
      id: dealer.cityDetail.id,
      name: dealer.cityDetail.name,
    } : {
      id: dealer.city_id || null,
      name: dealer.city || '',
    };
    const districtDetail = fallbackDistrict ? {
      id: fallbackDistrict.id,
      name: fallbackDistrict.name,
    } : {
      id: dealer.district_id || null,
      name: dealer.district || '',
    };
    const stateDetail = fallbackState ? {
      id: fallbackState.id,
      name: fallbackState.name,
    } : {
      id: dealer.state_id || null,
      name: dealer.state || '',
    };

    const dealerProfile = dealer.dealerProfile || {
      id: null,
      user_id: dealer.id,
      company_name: dealer.full_name || 'Seller',
      door_no: '',
      building_name: '',
      street_name: '',
      pincode: '',
      alt_phone: null,
      verified: false,
    };

    const locationText = [cityDetail.name, districtDetail.name, stateDetail.name].filter(Boolean).join(', ');

    const showroomLocation = {
      showroom_name: dealerProfile.company_name || dealer.full_name || 'Dealer',
      door_no: dealerProfile.door_no || '',
      building_name: dealerProfile.building_name || '',
      street_name: dealerProfile.street_name || '',
      pincode: dealerProfile.pincode || '',
      city: cityDetail.name || '',
      city_id: cityDetail.id || null,
      district: districtDetail.name || '',
      district_id: districtDetail.id || null,
      state: stateDetail.name || '',
      state_id: stateDetail.id || null,
      address_text: [dealerProfile.door_no, dealerProfile.building_name, dealerProfile.street_name, cityDetail.name, districtDetail.name, stateDetail.name, dealerProfile.pincode].filter(Boolean).join(', '),
    };

    const ALLOWED_SORT_BY = ['created_at', 'price', 'km_driven', 'year'];
    const ALLOWED_SORT_ORDER = ['ASC', 'DESC'];

    const rawSortBy = String(req.query.sort_by || 'created_at').trim().toLowerCase();
    const sortBy = ALLOWED_SORT_BY.includes(rawSortBy) ? rawSortBy : 'created_at';

    const rawSortOrder = String(req.query.sort_order || 'DESC').trim().toUpperCase();
    const sortOrder = ALLOWED_SORT_ORDER.includes(rawSortOrder) ? rawSortOrder : 'DESC';

    const result = await dealerService.getDealerCars(
      dealerId,
      req.query,
      parseInt(req.query.page, 10) || 1,
      parseInt(req.query.limit, 10) || 20,
      sortBy,
      sortOrder,
      'public',
      viewerUserId
    );

    const total = result.pagination?.total !== undefined ? result.pagination.total : (result.total || result.cars?.length || 0);
    const page = result.pagination?.page || parseInt(req.query.page, 10) || 1;
    const limit = result.pagination?.limit || parseInt(req.query.limit, 10) || 20;
    const totalPages = result.pagination?.totalPages || Math.ceil(total / limit) || 1;
    const pagination = result.pagination || {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    res.status(200).json({
      status: 'success',
      data: {
        ...result,
        cars: result.cars || [],
        vehicles: result.vehicles || result.cars || [],
        commercial: [],
        total,
        page,
        limit,
        totalPages,
        pagination,
        dealerProfile,
        cityDetail,
        districtDetail,
        stateDetail,
        location_text: locationText,
        showroom_location: showroomLocation,
        dealer: {
          id: dealer.id,
          full_name: dealer.full_name,
          phone: dealer.phone,
          email: dealer.email,
          profile_picture: dealer.profile_picture,
          whatsapp_number: dealer.whatsapp_number,
          use_registered_for_whatsapp: dealer.use_registered_for_whatsapp,
          role: dealer.role,
          dealerProfile,
          cityDetail,
          districtDetail,
          stateDetail,
          location_text: locationText,
          showroom_location: showroomLocation,
        },
        id: dealer.id,
        full_name: dealer.full_name,
        phone: dealer.phone,
        email: dealer.email,
        profile_picture: dealer.profile_picture,
        whatsapp_number: dealer.whatsapp_number,
        use_registered_for_whatsapp: dealer.use_registered_for_whatsapp,
      },
    });
  } catch (error) {
    next(error);
  }
};