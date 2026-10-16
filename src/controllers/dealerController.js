const dealerService = require('../services/dealerService');
const { catchAsync, AppError } = require('../utils/errorHandler');

/**
 * Resolves :id parameter. If :id === 'me', resolves to the authenticated user's ID.
 * Returns 401 if 'me' is requested without authentication.
 */
const resolveDealerId = (req) => {
  let dealerId = req.params.id;
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
  const dealer = await dealerService.getDealerById(dealerId);
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
    view
  );

  res.json({ status: 'success', data: result });
});
