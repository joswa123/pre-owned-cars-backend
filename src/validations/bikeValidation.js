const Joi = require('joi');

const FUEL_TYPES_IN = [
  'petrol',
  'electric',
  'cng',
  'hybrid',
  'others',
  'other',
];

const FUEL_TYPE_MAP = {
  petrol: 'Petrol',
  electric: 'Electric',
  cng: 'CNG',
  hybrid: 'Hybrid',
  others: 'Others',
  other: 'Others',
};

const OWNERSHIP_TYPES_IN = [
  '1st owner',
  '2nd owner',
  '3rd owner',
  '4th+ owner',
];

const OWNERSHIP_MAP = {
  '1st owner': '1st Owner',
  '2nd owner': '2nd Owner',
  '3rd owner': '3rd Owner',
  '4th+ owner': '4th+ Owner',
};

const INSURANCE_TYPE_IN = [
  'comprehensive',
  'third party',
  'not insured',
  'zero dep',
  'zero depreciation',
];

const INSURANCE_TYPE_MAP = {
  comprehensive: 'Comprehensive',
  'third party': 'Third Party',
  'not insured': 'Not Insured',
  'zero dep': 'Comprehensive',
  'zero depreciation': 'Comprehensive',
};

const STATUS_TYPES_IN = ['active', 'sold', 'deleted', 'expired'];
const SORT_BY_WHITELIST = ['created_at', 'price', 'km_driven', 'year', 'views_count'];

const optionalHybridId = Joi.alternatives()
  .try(Joi.string().uuid(), Joi.string().trim().min(1).max(100))
  .allow('', null)
  .optional();

const requiredHybridId = Joi.alternatives()
  .try(Joi.string().uuid(), Joi.string().trim().min(1).max(100))
  .required();

const enumString = (values) =>
  Joi.string()
    .trim()
    .custom((value, helpers) => {
      const normalized = value.toLowerCase();
      if (!values.includes(normalized)) {
        return helpers.error('any.only', { valids: values });
      }
      return value;
    });

/**
 * Validation schema for creating a Bike listing
 */
const createBikeSchema = Joi.object({
  brand_id: requiredHybridId,
  brand: Joi.string().trim().max(100).optional(),

  model_id: requiredHybridId,
  model: Joi.string().trim().max(100).optional(),

  vehicle_type_id: optionalHybridId,
  vehicle_type: Joi.string().trim().max(100).optional(),
  vehicleType: Joi.string().trim().max(100).optional(),

  title: Joi.string().trim().max(200).allow('', null).optional(),

  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  price: Joi.number().positive().max(100000000).required(),
  price_negotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional().default(false),
  priceNegotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  b2b: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  b2b_listing: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional().default(false),
  b2bListing: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  prior_appointments: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional().default(false),
  prior_appointemnts: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  priorAppointments: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  km_driven: Joi.number().integer().min(0).max(1000000).required(),
  kmdriven: Joi.number().integer().min(0).max(1000000).optional(),

  fuel_type: enumString(FUEL_TYPES_IN).required(),
  fueltype: enumString(FUEL_TYPES_IN).optional(),

  ownership: enumString(OWNERSHIP_TYPES_IN).optional().default('1st Owner'),
  description: Joi.string().trim().max(5000).allow('', null).optional(),

  insurance_type: enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  insuranceType: enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  insurance_expiry_date: Joi.date().iso().allow('', null).optional(),
  insuranceExpiryDate: Joi.date().iso().allow('', null).optional(),

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
  video: Joi.any().optional(),
  audio: Joi.any().optional(),
  video_url: Joi.alternatives().try(
    Joi.string().trim().pattern(/^https:\/\/res\.cloudinary\.com\//).message('Video URL must start with https://res.cloudinary.com/'),
    Joi.string().allow('', null)
  ).optional(),
  audio_url: Joi.alternatives().try(
    Joi.string().trim().pattern(/^https:\/\/res\.cloudinary\.com\//).message('Audio URL must start with https://res.cloudinary.com/'),
    Joi.string().allow('', null)
  ).optional(),
}).unknown(true);

/**
 * Validation schema for updating a Bike listing
 */
const updateBikeSchema = Joi.object({
  brand_id: optionalHybridId,
  brand: Joi.string().trim().max(100).optional(),

  model_id: optionalHybridId,
  model: Joi.string().trim().max(100).optional(),

  vehicle_type_id: optionalHybridId,
  vehicle_type: Joi.string().trim().max(100).optional(),
  vehicleType: Joi.string().trim().max(100).optional(),

  title: Joi.string().trim().max(200).allow('', null).optional(),

  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  price: Joi.number().positive().max(100000000).optional(),
  price_negotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  priceNegotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  b2b: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  b2b_listing: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  b2bListing: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  prior_appointments: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  prior_appointemnts: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  priorAppointments: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),

  km_driven: Joi.number().integer().min(0).max(1000000).optional(),
  kmdriven: Joi.number().integer().min(0).max(1000000).optional(),

  fuel_type: enumString(FUEL_TYPES_IN).optional(),
  fueltype: enumString(FUEL_TYPES_IN).optional(),

  ownership: enumString(OWNERSHIP_TYPES_IN).optional(),
  description: Joi.string().trim().max(5000).allow('', null).optional(),

  insurance_type: enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  insuranceType: enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  insurance_expiry_date: Joi.date().iso().allow('', null).optional(),
  insuranceExpiryDate: Joi.date().iso().allow('', null).optional(),

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

  video: Joi.any().optional(),
  audio: Joi.any().optional(),
  video_url: Joi.alternatives().try(
    Joi.string().trim().pattern(/^https:\/\/res\.cloudinary\.com\//).message('Video URL must start with https://res.cloudinary.com/'),
    Joi.string().allow('', null)
  ).optional(),
  audio_url: Joi.alternatives().try(
    Joi.string().trim().pattern(/^https:\/\/res\.cloudinary\.com\//).message('Audio URL must start with https://res.cloudinary.com/'),
    Joi.string().allow('', null)
  ).optional(),
  remove_video: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  remove_audio: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
}).unknown(true);

/**
 * Validation schema for querying Bikes
 */
const queryBikeSchema = Joi.object({
  page: Joi.number().integer().min(1).allow('', null).optional(),
  limit: Joi.number().integer().min(1).max(100).allow('', null).optional(),

  sort_by: Joi.string().valid(...SORT_BY_WHITELIST).allow('', null).optional(),
  sortBy: Joi.string().valid(...SORT_BY_WHITELIST).allow('', null).optional(),
  sort_order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').allow('', null).optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').allow('', null).optional(),

  vehicle_type_id: optionalHybridId,
  vehicle_type: Joi.string().allow('', null).optional(),
  vehicleType: Joi.string().allow('', null).optional(),

  brand_id: optionalHybridId,
  brand: Joi.string().allow('', null).optional(),
  brands: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

  model_id: optionalHybridId,
  model: Joi.string().allow('', null).optional(),
  models: Joi.alternatives().try(Joi.array(), Joi.string()).allow('', null).optional(),

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
  district_id: Joi.string().allow('', null).optional(),
  district: Joi.string().allow('', null).optional(),
  city_id: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),

  q: Joi.string().allow('', null).optional(),
  search: Joi.string().allow('', null).optional(),

  status: Joi.string().valid(...STATUS_TYPES_IN, 'all').allow('', null).optional(),
  posted_by_type: Joi.string().valid('dealer', 'customer', 'all').allow('', null).optional(),
  posted_within_days: Joi.number().integer().min(1).max(1000).allow('', null).optional(),

  b2b: Joi.boolean().truthy('true').falsy('false').allow('', null).optional(),
  b2b_listing: Joi.boolean().truthy('true').falsy('false').allow('', null).optional(),
  b2bListing: Joi.boolean().truthy('true').falsy('false').allow('', null).optional(),

  prior_appointments: Joi.boolean().truthy('true').falsy('false').allow('', null).optional(),
  user_id: Joi.alternatives().try(optionalHybridId, Joi.string().valid('me')).allow('', null).optional(),
  seller_id: Joi.alternatives().try(optionalHybridId, Joi.string().valid('me')).allow('', null).optional(),
  dealer_id: Joi.alternatives().try(optionalHybridId, Joi.string().valid('me')).allow('', null).optional(),
}).unknown(true);

/**
 * Normalizes input bike data into DB values
 */
const mapToBikeDbValues = (data) => {
  if (!data) return {};
  const mapped = { ...data };

  if (data.kmdriven !== undefined && mapped.km_driven === undefined) mapped.km_driven = data.kmdriven;
  if (data.fueltype !== undefined && mapped.fuel_type === undefined) mapped.fuel_type = data.fueltype;
  if (data.vehicleType !== undefined && mapped.vehicle_type === undefined) mapped.vehicle_type = data.vehicleType;
  if (data.priceNegotiable !== undefined && mapped.price_negotiable === undefined) mapped.price_negotiable = data.priceNegotiable;

  if (mapped.price_negotiable !== undefined) {
    mapped.price_negotiable = mapped.price_negotiable === true || mapped.price_negotiable === 'true' || mapped.price_negotiable === 1 || mapped.price_negotiable === '1';
  }

  const rawB2b = data.b2b_listing !== undefined ? data.b2b_listing : (data.b2b !== undefined ? data.b2b : data.b2bListing);
  if (rawB2b !== undefined) {
    mapped.b2b_listing = rawB2b === true || rawB2b === 'true' || rawB2b === 1 || rawB2b === '1';
  }

  const rawPrior = data.prior_appointments !== undefined
    ? data.prior_appointments
    : (data.prior_appointemnts !== undefined ? data.prior_appointemnts : data.priorAppointments);
  if (rawPrior !== undefined) {
    mapped.prior_appointments = rawPrior === true || rawPrior === 'true' || rawPrior === 1 || rawPrior === '1';
  }

  if (mapped.fuel_type && typeof mapped.fuel_type === 'string') {
    const lower = mapped.fuel_type.trim().toLowerCase();
    mapped.fuel_type = FUEL_TYPE_MAP[lower] || mapped.fuel_type.trim();
  }

  if (mapped.ownership && typeof mapped.ownership === 'string') {
    const lower = mapped.ownership.trim().toLowerCase();
    mapped.ownership = OWNERSHIP_MAP[lower] || mapped.ownership.trim();
  }

  const rawInsType = data.insurance_type !== undefined ? data.insurance_type : data.insuranceType;
  if (rawInsType !== undefined) {
    if (rawInsType && typeof rawInsType === 'string') {
      const lower = rawInsType.trim().toLowerCase();
      mapped.insurance_type = INSURANCE_TYPE_MAP[lower] || rawInsType.trim();
    } else if (rawInsType === '' || rawInsType === null) {
      mapped.insurance_type = 'Not Insured';
    }
  }

  const rawInsExpiry = data.insurance_expiry_date !== undefined
    ? data.insurance_expiry_date
    : data.insuranceExpiryDate;
  if (rawInsExpiry !== undefined) {
    mapped.insurance_expiry_date = rawInsExpiry && String(rawInsExpiry).trim() !== '' ? rawInsExpiry : null;
  }

  if (mapped.status && typeof mapped.status === 'string') {
    mapped.status = mapped.status.trim().toLowerCase();
  }

  return mapped;
};

module.exports = {
  createBikeSchema,
  updateBikeSchema,
  queryBikeSchema,
  mapToBikeDbValues,
  SORT_BY_WHITELIST,
  FUEL_TYPE_MAP,
  INSURANCE_TYPE_MAP,
};
