const dealerService = require('../services/dealerService');
const { catchAsync, AppError } = require('../utils/errorHandler');

/**
 * Resolves :id parameter. If :id === 'me', resolves to the authenticated user's ID.
 * Returns 401 if 'me' is requested without authentication.
 */
const resolveDealerId = (req) => {
  let dealerId = req.params.dealerId || req.params.id;
  if (dealerId === 'me') {
    if (!req.user?.id) {
      throw new AppError('Authentication required to access own inventory.', 401);
    }
    dealerId = req.user.id;
  }
  return dealerId;
};

const ALLOWED_SORT_BY = ['created_at', 'price', 'km_driven', 'year'];
const ALLOWED_SORT_ORDER = ['ASC', 'DESC'];

exports.getDealers = catchAsync(async (req, res) => {
  const { name, state_id, district_id, city_id, page = 1, limit = 20 } = req.query;
  const result = await dealerService.getActiveDealers(
    { name, state_id, district_id, city_id },
    page,
    limit
  );
  res.json({ status: 'success', data: result });
});

exports.getDealer = catchAsync(async (req, res) => {
  const dealerId = resolveDealerId(req);
  const dealer = await dealerService.getDealerById(dealerId, req.query.type);
  res.json({ status: 'success', data: dealer });
});

/**
 * GET /dealers/:id/cars/filters
 * Returns dynamic facet metadata computed over the dealer's visible inventory.
 */
exports.getDealerCarFilters = catchAsync(async (req, res) => {
  const dealerId = resolveDealerId(req);
  const isOwner = Boolean(req.user?.id && req.user.id === dealerId);
  const view = isOwner ? 'owner' : 'public';

  const result = await dealerService.getDealerCarFilters(dealerId, view);
  res.json({ status: 'success', data: result });
});

/**
 * GET /dealers/:id/cars
 * Returns filtered, paginated inventory for a dealer.
 */
exports.getDealerCars = catchAsync(async (req, res) => {
  const dealerId = resolveDealerId(req);
  const isOwner = Boolean(req.user?.id && req.user.id === dealerId);
  const view = isOwner ? 'owner' : 'public';

  const {
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'DESC',
    status,
    brand_id,
    model_id,
    fuel_type,
    transmission,
    body_type,
    ownership,
    board_type,
    min_price,
    max_price,
    min_km,
    max_km,
    min_year,
    max_year,
    search,
  } = req.query;

  const normalizedSortBy = String(sort_by).trim().toLowerCase();
  const normalizedSortOrder = String(sort_order).trim().toUpperCase();

  // Whitelist sort_by and sort_order. Reject unknown values with 400.
  if (!ALLOWED_SORT_BY.includes(normalizedSortBy)) {
    throw new AppError(
      `Invalid sort_by '${sort_by}'. Allowed fields: ${ALLOWED_SORT_BY.join(', ')}`,
      400
    );
  }

  if (!ALLOWED_SORT_ORDER.includes(normalizedSortOrder)) {
    throw new AppError(
      `Invalid sort_order '${sort_order}'. Allowed values: ${ALLOWED_SORT_ORDER.join(', ')}`,
      400
    );
  }

  const filters = {
    brand_id,
    model_id,
    fuel_type,
    transmission,
    body_type,
    ownership,
    board_type,
    min_price,
    max_price,
    min_km,
    max_km,
    min_year,
    max_year,
    search,
  };

  // Status override is ONLY allowed for the owner
  if (isOwner && status) {
    filters.status = status;
  }

  const result = await dealerService.getDealerCars(
    dealerId,
    filters,
    parseInt(page, 10) || 1,
    parseInt(limit, 10) || 20,
    normalizedSortBy,
    normalizedSortOrder,
    view,
    req.user?.id
  );

  res.json({
    status: 'success',
    data: {
      ...result,
      commercial: [],
    },
  });
});

/**
 * GET /dealers/:id/commercial/filters
 * Returns dynamic facet metadata computed over the dealer's visible commercial inventory.
 */
exports.getDealerCommercialFilters = catchAsync(async (req, res) => {
  const dealerId = resolveDealerId(req);
  const isOwner = Boolean(req.user?.id && req.user.id === dealerId);
  const view = isOwner ? 'owner' : 'public';

  const result = await dealerService.getDealerCommercialFilters(dealerId, view);
  res.json({ status: 'success', data: result });
});

/**
 * GET /dealers/:id/commercial
 * Returns filtered, paginated commercial inventory for a dealer.
 */
exports.getDealerCommercialVehicles = catchAsync(async (req, res) => {
  const dealerId = resolveDealerId(req);
  const isOwner = Boolean(req.user?.id && req.user.id === dealerId);
  const commercialVehicleService = require('../services/commercialVehicleService');
  const { User, DealerProfile, State, District, City } = require('../models');

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
    throw new AppError('Dealer not found', 404);
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

  const filters = { ...req.query, dealer_id: dealerId };
  if (!isOwner) {
    filters.status = 'active';
  }

  const result = await commercialVehicleService.getCommercialVehicles(
    filters,
    req.query.page || 1,
    req.query.limit || 20,
    req.query.sort_by || 'created_at',
    req.query.sort_order || 'DESC',
    req.user?.id || null,
    req.user?.role || null
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
});
