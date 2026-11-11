const Joi = require('joi');

const FUEL_TYPES_IN = [
  'petrol',
  'diesel',
  'cng',
  'electric',
  'hybrid',
  'lpg',
];

const OWNERSHIP_TYPES_IN = [
  '1st owner',
  '2nd owner',
  '3rd owner',
  '4th+ owner',
];

const STATUS_TYPES_IN = ['active', 'sold', 'deleted', 'expired'];

const SORT_BY_WHITELIST = ['created_at', 'price', 'km_driven', 'year', 'views_count'];

const FUEL_TYPE_MAP = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  electric: 'Electric',
  hybrid: 'Hybrid',
  lpg: 'LPG',
};

const OWNERSHIP_MAP = {
  '1st owner': '1st Owner',
  '2nd owner': '2nd Owner',
  '3rd owner': '3rd Owner',
  '4th+ owner': '4th+ Owner',
};

const hybridId = Joi.alternatives().try(
  Joi.string().guid({ version: ['uuidv4'] }),
  Joi.string().uuid(),
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/)
);

const optionalHybridId = Joi.alternatives().try(
  Joi.string().guid({ version: ['uuidv4'] }),
  Joi.string().uuid(),
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/)
).allow('', null).optional();

const enumString = (values) =>
  Joi.string().trim().lowercase().valid(...values);

/**
 * Validation schema for creating a Commercial Vehicle
 */
const createCommercialVehicleSchema = Joi.object({
  vehicle_type_id: optionalHybridId,
  vehicle_type: Joi.string().trim().max(100).optional(),
  vehicleType: Joi.string().trim().max(100).optional(),

  brand_id: optionalHybridId,
  brand: Joi.string().trim().max(100).optional(),

  year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).required(),
  price: Joi.number().positive().max(100000000).required(),
  price_negotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).default(false),
  priceNegotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  km_driven: Joi.number().integer().min(0).max(2000000).required(),
  kmdriven: Joi.number().integer().min(0).max(2000000).optional(),

  fuel_type: enumString(FUEL_TYPES_IN).required(),
  fueltype: enumString(FUEL_TYPES_IN).optional(),

  ownership: enumString(OWNERSHIP_TYPES_IN).required(),

  description: Joi.string().trim().max(5000).allow('', null).optional(),

  state_id: Joi.string().uuid().allow('', null).optional(),
  district_id: Joi.string().uuid().allow('', null).optional(),
  city_id: Joi.string().uuid().allow('', null).optional(),

  state: Joi.string().trim().allow('', null).optional(),
  district: Joi.string().trim().allow('', null).optional(),
  city: Joi.string().trim().allow('', null).optional(),

  primary_image: Joi.alternatives().try(
    Joi.string().trim().pattern(/^https:\/\/res\.cloudinary\.com\//).message('Primary image URL must start with https://res.cloudinary.com/'),
    Joi.any()
  ).optional(),

  secondary_images: Joi.any().optional(),
  images: Joi.any().optional(),
}).unknown(true);

/**
 * Validation schema for updating a Commercial Vehicle
 */
const updateCommercialVehicleSchema = Joi.object({
  vehicle_type_id: optionalHybridId,
  vehicle_type: Joi.string().trim().max(100).optional(),
  vehicleType: Joi.string().trim().max(100).optional(),

  brand_id: optionalHybridId,
  brand: Joi.string().trim().max(100).optional(),

  year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).optional(),
  price: Joi.number().positive().max(100000000).optional(),
  price_negotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  priceNegotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  km_driven: Joi.number().integer().min(0).max(2000000).optional(),
  kmdriven: Joi.number().integer().min(0).max(2000000).optional(),

  fuel_type: enumString(FUEL_TYPES_IN).optional(),
  fueltype: enumString(FUEL_TYPES_IN).optional(),

  ownership: enumString(OWNERSHIP_TYPES_IN).optional(),

  description: Joi.string().trim().max(5000).allow('', null).optional(),

  status: enumString(STATUS_TYPES_IN).optional(),

  state_id: Joi.string().uuid().allow('', null).optional(),
  district_id: Joi.string().uuid().allow('', null).optional(),
  city_id: Joi.string().uuid().allow('', null).optional(),

  state: Joi.string().trim().allow('', null).optional(),
  district: Joi.string().trim().allow('', null).optional(),
  city: Joi.string().trim().allow('', null).optional(),

  primary_image: Joi.alternatives().try(
    Joi.string().trim().pattern(/^https:\/\/res\.cloudinary\.com\//).message('Primary image URL must start with https://res.cloudinary.com/'),
    Joi.any()
  ).optional(),

  secondary_images: Joi.any().optional(),
  images: Joi.any().optional(),
  replace_images: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  images_to_keep: Joi.any().optional(),
}).unknown(true);

/**
 * Validation schema for querying Commercial Vehicles
 */
const queryCommercialVehicleSchema = Joi.object({
  page: Joi.number().integer().min(1).allow('', null).optional(),
  limit: Joi.number().integer().min(1).max(100).allow('', null).optional(),

  sort_by: Joi.string().valid(...SORT_BY_WHITELIST).allow('', null).optional(),
  sortBy: Joi.string().valid(...SORT_BY_WHITELIST).allow('', null).optional(),

  sort_order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').allow('', null).optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').allow('', null).optional(),

  vehicle_type_id: optionalHybridId,
  vehicle_type: Joi.string().allow('', null).optional(),
  vehicle_types: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),
  vehicleType: Joi.string().allow('', null).optional(),

  brand_id: optionalHybridId,
  brand: Joi.string().allow('', null).optional(),
  brands: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

  min_price: Joi.number().min(0).allow('', null).optional(),
  max_price: Joi.number().min(0).allow('', null).optional(),
  minPrice: Joi.number().min(0).allow('', null).optional(),
  maxPrice: Joi.number().min(0).allow('', null).optional(),
  price: Joi.number().min(0).allow('', null).optional(),

  min_km: Joi.number().min(0).allow('', null).optional(),
  max_km: Joi.number().min(0).allow('', null).optional(),
  minKm: Joi.number().min(0).allow('', null).optional(),
  maxKm: Joi.number().min(0).allow('', null).optional(),
  km_driven: Joi.number().min(0).allow('', null).optional(),
  kmdriven: Joi.number().min(0).allow('', null).optional(),

  fuel_type: Joi.string().allow('', null).optional(),
  fuel_types: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),
  fueltype: Joi.string().allow('', null).optional(),

  ownership: Joi.string().allow('', null).optional(),
  ownerships: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

  min_year: Joi.number().integer().min(1900).max(2100).allow('', null).optional(),
  max_year: Joi.number().integer().min(1900).max(2100).allow('', null).optional(),
  minYear: Joi.number().integer().min(1900).max(2100).allow('', null).optional(),
  maxYear: Joi.number().integer().min(1900).max(2100).allow('', null).optional(),
  year: Joi.number().integer().min(1900).max(2100).allow('', null).optional(),

  state_id: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  states: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

  district_id: Joi.string().allow('', null).optional(),
  district: Joi.string().allow('', null).optional(),
  districts: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

  city_id: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  cities: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

  q: Joi.string().allow('', null).optional(),
  search: Joi.string().allow('', null).optional(),

  status: Joi.string().valid(...STATUS_TYPES_IN, 'all').allow('', null).optional(),
  posted_by_type: Joi.string().valid('dealer', 'customer', 'all').allow('', null).optional(),
  posted_within_days: Joi.number().integer().min(1).max(1000).allow('', null).optional(),
  postedWithinDays: Joi.number().integer().min(1).max(1000).allow('', null).optional(),
  include_expired: Joi.boolean().truthy('true').falsy('false').allow('', null).optional(),

  user_id: Joi.alternatives().try(optionalHybridId, Joi.string().valid('me')).allow('', null).optional(),
  seller_id: Joi.alternatives().try(optionalHybridId, Joi.string().valid('me')).allow('', null).optional(),
}).unknown(false);

/**
 * Normalizes input commercial data into DB values
 */
const mapToCommercialDbValues = (data) => {
  if (!data) return {};
  const mapped = { ...data };

  // Field aliases
  if (data.kmdriven !== undefined && mapped.km_driven === undefined) {
    mapped.km_driven = data.kmdriven;
  }
  if (data.fueltype !== undefined && mapped.fuel_type === undefined) {
    mapped.fuel_type = data.fueltype;
  }
  if (data.vehicleType !== undefined && mapped.vehicle_type === undefined) {
    mapped.vehicle_type = data.vehicleType;
  }
  if (data.priceNegotiable !== undefined && mapped.price_negotiable === undefined) {
    mapped.price_negotiable = data.priceNegotiable;
  }

  // Boolean normalization
  if (mapped.price_negotiable !== undefined) {
    mapped.price_negotiable =
      mapped.price_negotiable === true ||
      mapped.price_negotiable === 'true' ||
      mapped.price_negotiable === 1 ||
      mapped.price_negotiable === '1';
  }

  // Fuel type map
  const rawFuel = (mapped.fuel_type || '').toString().trim().toLowerCase();
  if (rawFuel && FUEL_TYPE_MAP[rawFuel]) {
    mapped.fuel_type = FUEL_TYPE_MAP[rawFuel];
  }

  // Ownership map
  const rawOwn = (mapped.ownership || '').toString().trim().toLowerCase();
  if (rawOwn && OWNERSHIP_MAP[rawOwn]) {
    mapped.ownership = OWNERSHIP_MAP[rawOwn];
  }

  return mapped;
};

module.exports = {
  createCommercialVehicleSchema,
  updateCommercialVehicleSchema,
  queryCommercialVehicleSchema,
  mapToCommercialDbValues,
  SORT_BY_WHITELIST,
  FUEL_TYPE_MAP,
  OWNERSHIP_MAP,
};

