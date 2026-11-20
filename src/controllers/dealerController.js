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

  res.json({ status: 'success', data: result });
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
      { model: City, as: 'cityDetail', attributes: ['id', 'name'] },
    ],
  });

  if (!dealer) {
    throw new AppError('Dealer not found', 404);
  }

  const cityDetail = dealer.cityDetail
    ? (dealer.cityDetail.toJSON ? dealer.cityDetail.toJSON() : dealer.cityDetail)
    : { id: dealer.city_id || null, name: dealer.city || '' };

  const districtDetail = dealer.districtDetail
    ? (dealer.districtDetail.toJSON ? dealer.districtDetail.toJSON() : dealer.districtDetail)
    : { id: dealer.district_id || null, name: dealer.district || '' };

  const stateDetail = dealer.stateDetail
    ? (dealer.stateDetail.toJSON ? dealer.stateDetail.toJSON() : dealer.stateDetail)
    : { id: dealer.state_id || null, name: dealer.state || '' };

  const dealerProfile = dealer.dealerProfile
    ? (dealer.dealerProfile.toJSON ? dealer.dealerProfile.toJSON() : dealer.dealerProfile)
    : {
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

  res.status(200).json({
    status: 'success',
    data: {
      ...result,
      dealerProfile,
      cityDetail,
      districtDetail,
      stateDetail,
      location_text: locationText,
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
