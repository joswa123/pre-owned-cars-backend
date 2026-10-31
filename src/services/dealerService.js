const {
  User,
  DealerProfile,
  Car,
  CarImage,
  Brand,
  Model,
  Variant,
  State,
  District,
  City,
} = require('../models');
const { Op, Sequelize, fn, col } = require('sequelize');
const crypto = require('crypto');
const redisClient = require('../config/redis');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');

/**
 * Get active dealers with filters and pagination
 */
exports.getActiveDealers = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const where = {
    role: 'dealer',
    status: 'approved',
  };

  // Search by name or company name
  if (filters.name) {
    const search = `%${filters.name}%`;
    where[Op.or] = [
      { full_name: { [Op.like]: search } },
      { '$dealerProfile.company_name$': { [Op.like]: search } },
    ];
  }

  // Location filters
  if (filters.state_id) where.state_id = filters.state_id;
  if (filters.district_id) where.district_id = filters.district_id;
  if (filters.city_id) where.city_id = filters.city_id;

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture', 'state_id', 'district_id', 'city_id'],
    include: [
      {
        model: DealerProfile,
        as: 'dealerProfile',
        attributes: ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'verified'],
      },
      { model: State, as: 'stateDetail', attributes: ['name'] },
      { model: District, as: 'districtDetail', attributes: ['name'] },
      { model: City, as: 'cityDetail', attributes: ['name'] },
    ],
    limit: parseInt(limit, 10),
    offset,
    order: [['full_name', 'ASC']],
  });

  // Transform to include location_text
  const dealers = rows.map((dealer) => {
    const d = dealer.toJSON();
    d.location_text = [d.cityDetail?.name, d.districtDetail?.name, d.stateDetail?.name].filter(Boolean).join(', ');
    return d;
  });

  return {
    dealers,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Get a single dealer by ID
 */
exports.getDealerById = async (dealerId) => {
  const dealer = await User.findOne({
    where: { id: dealerId, role: 'dealer', status: 'approved' },
    attributes: [
      'id',
      'full_name',
      'phone',
      'email',
      'profile_picture',
      'state_id',
      'district_id',
      'city_id',
      'whatsapp_number',
      'use_registered_for_whatsapp',
    ],
    include: [
      {
        model: DealerProfile,
        as: 'dealerProfile',
        attributes: ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'verified'],
      },
      { model: State, as: 'stateDetail', attributes: ['name'] },
      { model: District, as: 'districtDetail', attributes: ['name'] },
      { model: City, as: 'cityDetail', attributes: ['name'] },
      {
        model: Car,
        as: 'postedCars',
        limit: 20,
        order: [['created_at', 'DESC']],
        where: { status: 'active', deleted_at: null },
        required: false,
        include: [
          { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
          { model: District, as: 'district', attributes: ['id', 'name'] },
          { model: City, as: 'city', attributes: ['id', 'name'] },
        ],
      },
    ],
  });

  if (!dealer) throw new AppError('Dealer not found', 404);

  const { transformCarImages } = require('./carService');
  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const dealerJson = dealer.toJSON();
  dealerJson.location_text = [dealerJson.cityDetail?.name, dealerJson.districtDetail?.name, dealerJson.stateDetail?.name]
    .filter(Boolean)
    .join(', ');

  if (Array.isArray(dealerJson.postedCars)) {
    dealerJson.postedCars = dealerJson.postedCars.map(c => transformCarImages(c, baseUrl));
  }
  return dealerJson;
};

/**
 * Verify dealer existence according to view perspective
 */
const verifyDealerExists = async (dealerId, view) => {
  const where = { id: dealerId, role: 'dealer' };
  if (view === 'public') {
    where.status = 'approved';
  }
  const dealer = await User.findOne({
    where,
    attributes: ['id', 'status', 'role'],
  });
  if (!dealer) {
    throw new AppError('Dealer not found or not active', 404);
  }
  return dealer;
};

const LOWERCASE_FIELDS = new Set([
  'fuel_type',
  'transmission',
  'body_type',
  'ownership',
  'board_type',
  'status',
]);

/**
 * Normalizes filter query parameters and produces a SHA-256 hash.
 * Drops empty/null values, trims strings, lowercases enum fields, sorts keys alphabetically.
 */
const buildNormalizedHash = (filters = {}, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC') => {
  const combined = {
    ...filters,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    sort_by: sortBy,
    sort_order: sortOrder,
  };

  const normalized = {};
  for (const [key, val] of Object.entries(combined)) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') continue;
      if (LOWERCASE_FIELDS.has(key)) {
        normalized[key] = trimmed.toLowerCase();
      } else {
        normalized[key] = trimmed;
      }
    } else if (typeof val === 'number') {
      normalized[key] = val;
    } else if (typeof val === 'boolean') {
      normalized[key] = val;
    }
  }

  // Sort keys alphabetically for deterministic hashing
  const sortedKeys = Object.keys(normalized).sort();
  const sortedObj = {};
  for (const k of sortedKeys) {
    sortedObj[k] = normalized[k];
  }

  return crypto.createHash('sha256').update(JSON.stringify(sortedObj)).digest('hex');
};

/**
 * Computes dealer facet aggregations directly from DB with 3s hard timeout & stale fallback.
 * Facets reflect full visible inventory (unfiltered, status-scoped).
 */
const computeDealerFiltersFromDb = async (dealerId, view, cacheResult = true) => {
  const baseWhere = {
    user_id: dealerId,
    deleted_at: null,
  };

  if (view === 'public') {
    baseWhere.status = 'active';
  } else {
    // Owner sees all visible inventory (draft, active, sold, expired)
    baseWhere.status = { [Op.ne]: 'deleted' };
  }

  const cacheKey = `dealer:${dealerId}:filters:${view}`;
  const staleKey = `${cacheKey}:stale`;

  const queryExecution = async () => {
    // Step 1: Overall summary stats (min/max price, km, year, and total cars)
    const stats = await Car.findOne({
      where: baseWhere,
      attributes: [
        [fn('COUNT', col('Car.id')), 'total_cars'],
        [fn('MIN', col('price')), 'min_price'],
        [fn('MAX', col('price')), 'max_price'],
        [fn('MIN', col('km_driven')), 'min_km'],
        [fn('MAX', col('km_driven')), 'max_km'],
        [fn('MIN', col('year')), 'min_year'],
        [fn('MAX', col('year')), 'max_year'],
      ],
      raw: true,
    });

    const totalCars = parseInt(stats?.total_cars, 10) || 0;

    if (totalCars === 0) {
      return {
        view,
        generated_at: new Date().toISOString(),
        semantics: 'Facets reflect dealer full visible inventory, computed from unfiltered status-scoped listings.',
        facets: {
          total_cars: 0,
          price_range: { min: null, max: null },
          km_range: { min: null, max: null },
          year_range: { min: null, max: null },
          brands: [],
          models: [],
          fuel_types: [],
          transmissions: [],
          body_types: [],
          ownerships: [],
          board_types: [],
        },
      };
    }

    // Step 2: Parallel grouped facet queries
    const [brands, models, fuelTypes, transmissions, bodyTypes, ownerships, boardTypes] = await Promise.all([
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['brand_id', 'id'],
          [col('brand.name'), 'name'],
          [fn('COUNT', col('Car.id')), 'count'],
        ],
        include: [{ model: Brand, as: 'brand', attributes: [] }],
        group: ['Car.brand_id', 'brand.name'],
        raw: true,
      }),
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['model_id', 'id'],
          'brand_id',
          [col('carModel.name'), 'name'],
          [fn('COUNT', col('Car.id')), 'count'],
        ],
        include: [{ model: Model, as: 'carModel', attributes: [] }],
        group: ['Car.model_id', 'Car.brand_id', 'carModel.name'],
        raw: true,
      }),
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['fuel_type', 'name'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['fuel_type'],
        raw: true,
      }),
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['transmission', 'name'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['transmission'],
        raw: true,
      }),
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['body_type', 'name'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['body_type'],
        raw: true,
      }),
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['ownership', 'name'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['ownership'],
        raw: true,
      }),
      Car.findAll({
        where: baseWhere,
        attributes: [
          ['board_type', 'name'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['board_type'],
        raw: true,
      }),
    ]);

    const formatBuckets = (list) =>
      (list || [])
        .filter((item) => item.name !== null && item.name !== undefined && String(item.name).trim() !== '')
        .map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          ...(item.brand_id ? { brand_id: item.brand_id } : {}),
          name: item.name,
          count: parseInt(item.count, 10) || 0,
        }));

    return {
      view,
      generated_at: new Date().toISOString(),
      semantics: 'Facets reflect dealer full visible inventory, computed from unfiltered status-scoped listings.',
      facets: {
        total_cars: totalCars,
        price_range: {
          min: stats.min_price !== null ? Number(stats.min_price) : null,
          max: stats.max_price !== null ? Number(stats.max_price) : null,
        },
        km_range: {
          min: stats.min_km !== null ? Number(stats.min_km) : null,
          max: stats.max_km !== null ? Number(stats.max_km) : null,
        },
        year_range: {
          min: stats.min_year !== null ? Number(stats.min_year) : null,
          max: stats.max_year !== null ? Number(stats.max_year) : null,
        },
        brands: formatBuckets(brands),
        models: formatBuckets(models),
        fuel_types: formatBuckets(fuelTypes),
        transmissions: formatBuckets(transmissions),
        body_types: formatBuckets(bodyTypes),
        ownerships: formatBuckets(ownerships),
        board_types: formatBuckets(boardTypes),
      },
    };
  };

  // Enforce a hard query timeout of 3s on facet aggregation
  const TIMEOUT_MS = 3000;
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error('Facet query timed out');
      err.code = 'ETIMEDOUT';
      reject(err);
    }, TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([queryExecution(), timeoutPromise]);
    clearTimeout(timerId);

    if (cacheResult && redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(result)).catch(() => {});
      await redisClient.setEx(staleKey, 86400, JSON.stringify(result)).catch(() => {});
    }

    return result;
  } catch (err) {
    clearTimeout(timerId);
    if (err.code === 'ETIMEDOUT') {
      console.warn(`[DealerService] Facet query timed out (3s) for dealer ${dealerId}`);
      // Return cached stale facets if available
      if (redisClient.isOpen) {
        try {
          const stale = await redisClient.get(staleKey);
          if (stale) {
            const staleData = JSON.parse(stale);
            staleData.is_stale = true;
            return staleData;
          }
        } catch (staleErr) {
          console.error('[DealerService] Redis stale get error:', staleErr);
        }
      }
      const unavailableError = new AppError('Facet aggregation service temporarily unavailable. Please retry shortly.', 503);
      unavailableError.retryAfter = 3;
      throw unavailableError;
    }
    throw err;
  }
};

/**
 * Get dynamic filter facets for a dealer's inventory.
 * Uses single-flight lock to prevent cache stampedes.
 */
exports.getDealerCarFilters = async (dealerId, view = 'public') => {
  await verifyDealerExists(dealerId, view);

  const cacheKey = `dealer:${dealerId}:filters:${view}`;
  const lockKey = `dealer:${dealerId}:filters:lock`;

  // 1. Try reading from cache
  if (redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('[DealerService] Redis cache read error for filters:', err);
    }
  }

  // 2. Cache miss: Single-flight lock (SET dealer:{uuid}:filters:lock 1 NX EX 5)
  let lockAcquired = false;
  if (redisClient.isOpen) {
    try {
      const lockRes = await redisClient.set(lockKey, '1', { NX: true, EX: 5 });
      lockAcquired = Boolean(lockRes);
    } catch (err) {
      console.error('[DealerService] Redis lock acquisition error:', err);
    }

    if (!lockAcquired) {
      // Lock failed: wait 50ms and re-read cache
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        const retryCached = await redisClient.get(cacheKey);
        if (retryCached) {
          return JSON.parse(retryCached);
        }
      } catch (err) {
        console.error('[DealerService] Redis retry cache read error:', err);
      }
      // If still missing, query DB directly without caching (avoid cache stampede)
      return await computeDealerFiltersFromDb(dealerId, view, false);
    }
  }

  // 3. Lock acquired: compute from DB, write to cache, release lock
  try {
    return await computeDealerFiltersFromDb(dealerId, view, true);
  } finally {
    if (lockAcquired && redisClient.isOpen) {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
};

/**
 * Get active cars of a dealer with comprehensive filters, whitelisted sorting, and tiered caching
 */
exports.getDealerCars = async (
  dealerId,
  filters = {},
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  view = 'public'
) => {
  await verifyDealerExists(dealerId, view);

  // 1. Construct base WHERE clause with deleted_at IS NULL
  const where = {
    user_id: dealerId,
    deleted_at: null,
  };

  if (view === 'public') {
    where.status = 'active';
  } else {
    // Owner view: default to all non-deleted (draft, active, sold, expired)
    // Add ?status= override for the owner to filter by status
    if (filters.status && typeof filters.status === 'string' && filters.status.trim() !== '') {
      where.status = filters.status.trim().toLowerCase();
    } else {
      where.status = { [Op.ne]: 'deleted' };
    }
  }

  // 2. Apply field filters
  if (filters.brand_id) {
    where.brand_id = filters.brand_id.trim();
  }
  if (filters.model_id) {
    where.model_id = filters.model_id.trim();
  }
  if (filters.fuel_type) {
    where.fuel_type = filters.fuel_type.trim();
  }
  if (filters.transmission) {
    where.transmission = filters.transmission.trim();
  }
  if (filters.body_type) {
    where.body_type = filters.body_type.trim();
  }
  if (filters.ownership) {
    where.ownership = filters.ownership.trim();
  }
  if (filters.board_type) {
    where.board_type = filters.board_type.trim();
  }

  // Price range
  if (filters.min_price !== undefined || filters.max_price !== undefined) {
    where.price = {};
    if (filters.min_price !== undefined && filters.min_price !== '') {
      where.price[Op.gte] = parseFloat(filters.min_price);
    }
    if (filters.max_price !== undefined && filters.max_price !== '') {
      where.price[Op.lte] = parseFloat(filters.max_price);
    }
  }

  // KM range
  if (filters.min_km !== undefined || filters.max_km !== undefined) {
    where.km_driven = {};
    if (filters.min_km !== undefined && filters.min_km !== '') {
      where.km_driven[Op.gte] = parseInt(filters.min_km, 10);
    }
    if (filters.max_km !== undefined && filters.max_km !== '') {
      where.km_driven[Op.lte] = parseInt(filters.max_km, 10);
    }
  }

  // Year range
  if (filters.min_year !== undefined || filters.max_year !== undefined) {
    where.year = {};
    if (filters.min_year !== undefined && filters.min_year !== '') {
      where.year[Op.gte] = parseInt(filters.min_year, 10);
    }
    if (filters.max_year !== undefined && filters.max_year !== '') {
      where.year[Op.lte] = parseInt(filters.max_year, 10);
    }
  }

  // Search filter
  // Minimum term length is 3 characters due to MySQL InnoDB FULLTEXT index configuration.
  // Terms under 3 characters fall back to prefix matching on number_plate.
  if (filters.search && typeof filters.search === 'string') {
    const cleanSearch = filters.search.trim();
    if (cleanSearch.length >= 3) {
      where[Op.and] = Sequelize.literal(
        `MATCH(Car.description, Car.number_plate) AGAINST(${sequelize.escape(cleanSearch + '*')} IN BOOLEAN MODE)`
      );
    } else if (cleanSearch.length > 0) {
      where.number_plate = { [Op.like]: `${cleanSearch}%` };
    }
  }

  // 3. Normalization and SHA-256 Hash
  const sortedHash = buildNormalizedHash(filters, page, limit, sortBy, sortOrder);
  const countCacheKey = `dealer:${dealerId}:count:${view}:${sortedHash}`;
  const carsCacheKey = `dealer:${dealerId}:cars:${view}:${sortedHash}`;

  // 4. Cache total_count for filtered queries separately with a 60s TTL
  let totalCount = null;
  if (redisClient.isOpen) {
    try {
      const cachedCount = await redisClient.get(countCacheKey);
      if (cachedCount !== null) {
        totalCount = parseInt(cachedCount, 10);
      }
    } catch (err) {
      console.error('[DealerService] Redis get count error:', err);
    }
  }

  if (totalCount === null) {
    totalCount = await Car.count({ where });
    if (redisClient.isOpen) {
      await redisClient.setEx(countCacheKey, 60, String(totalCount)).catch(() => {});
    }
  }

  // 5. Cache eligibility: Only cache pages 1–5 and filtered result sets under 200 rows.
  // Pages 6+ and result sets over 200 bypass cache and query DB directly.
  const isCacheEligible = page >= 1 && page <= 5 && totalCount <= 200;

  if (isCacheEligible && redisClient.isOpen) {
    try {
      const cachedCars = await redisClient.get(carsCacheKey);
      if (cachedCars) {
        return {
          cars: JSON.parse(cachedCars),
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1,
          },
        };
      }
    } catch (err) {
      console.error('[DealerService] Redis get cars error:', err);
    }
  }

  // 6. DB Query
  const offset = (page - 1) * limit;
  const cars = await Car.findAll({
    where,
    include: [
      { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
      { model: Brand, as: 'brand', attributes: ['id', 'name', 'logo'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
      { model: State, as: 'state', attributes: ['id', 'name', 'code'] },
      { model: District, as: 'district', attributes: ['id', 'name'] },
      { model: City, as: 'city', attributes: ['id', 'name'] },
    ],
    order: [[sortBy, sortOrder]],
    limit: parseInt(limit, 10),
    offset,
  });

  const { transformCarImages } = require('./carService');
  const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';
  const transformedCars = cars.map(c => transformCarImages(c, baseUrl));

  if (isCacheEligible && redisClient.isOpen) {
    try {
      await redisClient.setEx(carsCacheKey, 120, JSON.stringify(transformedCars)).catch(() => {}); // 2 min TTL
    } catch (err) {
      console.error('[DealerService] Redis set cars error:', err);
    }
  }

  return {
    cars: transformedCars,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1,
    },
  };
};
