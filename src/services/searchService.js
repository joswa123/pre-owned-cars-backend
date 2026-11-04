const carService = require('./carService');
const commercialVehicleService = require('./commercialVehicleService');

/**
 * Unified Global Search across Car and Commercial Vehicle listings
 */
exports.globalSearch = async (query = {}, userId = null, userRole = null) => {
  const {
    q = '',
    search = '',
    target_type = 'all',
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'DESC',
    ...filters
  } = query;

  const searchTerm = (q || search || '').trim();
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const normalizedType = String(target_type).toLowerCase();

  const commonFilters = {
    ...filters,
    search: searchTerm,
    q: searchTerm,
  };

  if (normalizedType === 'commercial') {
    const commResult = await commercialVehicleService.getCommercialVehicles(
      commonFilters,
      parsedPage,
      parsedLimit,
      sort_by,
      sort_order,
      userId,
      userRole
    );
    const results = (commResult.vehicles || []).map((v) => ({
      ...v,
      target_type: 'commercial',
      target_id: v.id,
    }));

    return {
      total: commResult.total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: commResult.totalPages,
      target_type: 'commercial',
      results,
      vehicles: results,
      cars: results,
    };
  }

  if (normalizedType === 'car') {
    const carResult = await carService.getCars(
      commonFilters,
      parsedPage,
      parsedLimit,
      sort_by,
      sort_order,
      userId,
      userRole
    );
    const results = (carResult.cars || []).map((c) => ({
      ...c,
      target_type: 'car',
      target_id: c.id,
    }));

    return {
      total: carResult.total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: carResult.totalPages,
      target_type: 'car',
      results,
      cars: results,
      vehicles: results,
    };
  }

  // target_type === 'all'
  // Fetch from both sources
  const [carResult, commResult] = await Promise.all([
    carService.getCars(commonFilters, 1, 100, sort_by, sort_order, userId, userRole).catch(() => ({ total: 0, cars: [] })),
    commercialVehicleService.getCommercialVehicles(commonFilters, 1, 100, sort_by, sort_order, userId, userRole).catch(() => ({ total: 0, vehicles: [] })),
  ]);

  const cars = (carResult.cars || []).map((c) => ({
    ...c,
    target_type: 'car',
    target_id: c.id,
  }));

  const comms = (commResult.vehicles || []).map((v) => ({
    ...v,
    target_type: 'commercial',
    target_id: v.id,
  }));

  const allCombined = [...cars, ...comms];

  // Sort combined results
  const isAsc = String(sort_order).toUpperCase() === 'ASC';
  allCombined.sort((a, b) => {
    if (sort_by === 'price') {
      const priceA = Number(a.price) || 0;
      const priceB = Number(b.price) || 0;
      return isAsc ? priceA - priceB : priceB - priceA;
    }
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return isAsc ? dateA - dateB : dateB - dateA;
  });

  const total = allCombined.length;
  const startIndex = (parsedPage - 1) * parsedLimit;
  const pagedResults = allCombined.slice(startIndex, startIndex + parsedLimit);

  return {
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
    target_type: 'all',
    results: pagedResults,
    vehicles: pagedResults,
    cars: pagedResults,
  };
};

