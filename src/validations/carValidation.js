const Joi = require('joi');

const FUEL_TYPES_IN         = ['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg'];
const TRANSMISSION_TYPES_IN = ['manual', 'automatic', 'clutchless manual', 'clutchless-manual', 'imt', 'cvt', 'dct'];
const OWNERSHIP_TYPES_IN    = ['1st owner', '2nd owner', '3rd owner', '4th+ owner'];
const INSURANCE_TYPE_IN     = ['comprehensive', 'third party', 'not insured'];
const BOARD_TYPES_IN        = ['own board', 't-board', 'commercial'];

const enumString = (values) =>
  Joi.string().trim().lowercase().valid(...values);

const STATUS_TYPES_IN = ['sold', 'active', 'deleted', 'expired'];

/**
 * Create Car Joi Schema
 */
const createCarSchema = Joi.object({
  brand_id:         Joi.string().uuid().optional(),
  brand:            Joi.string().trim().max(100).optional(),
  model_id:         Joi.string().uuid().optional(),
  model:            Joi.string().trim().max(100).optional(),
  variant_id:       Joi.string().uuid().optional(),
  variant:          Joi.string().trim().max(100).optional(),
  year:             Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  price:            Joi.number().positive().required(),
  price_negotiable: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).default(false),
  km_driven:        Joi.number().integer().min(0).optional(),
  kmdriven:         Joi.number().integer().min(0).optional(),
  fuel_type:        enumString(FUEL_TYPES_IN).optional(),
  fueltype:         enumString(FUEL_TYPES_IN).optional(),
  transmission:     enumString(TRANSMISSION_TYPES_IN).required(),
  ownership:        enumString(OWNERSHIP_TYPES_IN).required(),
  body_type:        Joi.string().trim().max(50).optional(),
  car_type:         Joi.string().trim().max(50).optional(),
  board_type:       enumString(BOARD_TYPES_IN).optional(),
  numplate:         Joi.string().trim().max(50).optional(),
  insurance_expiry_date: Joi.date().iso().allow('', null).optional(),
  insurance_type:   enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  insuranceType:    enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  b2b_listing:      Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).default(false),
  description:      Joi.string().trim().allow('', null).optional(),
  color:            Joi.string().trim().max(50).allow('', null).optional(),
  number_plate:     Joi.string().trim().max(50).allow('', null).optional(),
  numberplate:      Joi.string().trim().max(50).allow('', null).optional(),
  prior_appointments: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).default(false),
  prior_appointemnts: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).default(false),
  status:           enumString(STATUS_TYPES_IN).optional(),
  state_id:         Joi.string().uuid().allow('', null).optional(),
  district_id:      Joi.string().uuid().allow('', null).optional(),
  city_id:          Joi.string().uuid().allow('', null).optional(),
  primary_image:    Joi.any().optional(),
  images:           Joi.any().optional(),
}).or('brand_id', 'brand')
  .or('model_id', 'model')
  .or('variant_id', 'variant')
  .or('km_driven', 'kmdriven')
  .or('fuel_type', 'fueltype')
  .or('body_type', 'car_type')
  .or('board_type', 'numplate')
  .unknown(true);

/**
 * Update Car Joi Schema
 */
const updateCarSchema = Joi.object({
  brand_id:         Joi.string().uuid().optional(),
  brand:            Joi.string().trim().max(50),
  model_id:         Joi.string().uuid().optional(),
  model:            Joi.string().trim().max(50),
  variant_id:       Joi.string().uuid().optional(),
  variant:          Joi.string().trim().max(50),
  year:             Joi.number().integer().min(1900).max(new Date().getFullYear() + 1),
  price:            Joi.number().positive(),
  price_negotiable: Joi.boolean(),
  km_driven:        Joi.number().integer().min(0),
  kmdriven:         Joi.number().integer().min(0),
  fuel_type:        enumString(FUEL_TYPES_IN),
  fueltype:         enumString(FUEL_TYPES_IN),
  transmission:     enumString(TRANSMISSION_TYPES_IN),
  ownership:        enumString(OWNERSHIP_TYPES_IN),
  body_type:        Joi.string().trim().max(50),
  car_type:         Joi.string().trim().max(50),
  board_type:       enumString(BOARD_TYPES_IN),
  numplate:         Joi.string().trim().max(50),
  insurance_expiry_date: Joi.date().iso().allow('', null),
  insurance_type:   enumString(INSURANCE_TYPE_IN).allow('', null),
  insuranceType:    enumString(INSURANCE_TYPE_IN).allow('', null),
  b2b_listing:      Joi.boolean(),
  status:           enumString(STATUS_TYPES_IN),
  description:      Joi.string().trim().allow('', null),
  color:            Joi.string().trim().max(50).allow('', null),
  number_plate:     Joi.string().trim().max(50).allow('', null),
  numberplate:      Joi.string().trim().max(50).allow('', null),
  prior_appointments: Joi.boolean(),
  prior_appointemnts: Joi.boolean(),
  images_to_keep:   Joi.alternatives().try(
    Joi.array().items(Joi.string().uuid()),
    Joi.string()
  ).optional(),
  replace_images:   Joi.boolean().optional(),
}).unknown(true).min(1);

// DB Mapping Helpers
const FUEL_TYPE_MAP = {
  petrol:   'Petrol',
  diesel:   'Diesel',
  electric: 'Electric',
  hybrid:   'Hybrid',
  cng:      'CNG',
  lpg:      'LPG',
};

const TRANSMISSION_MAP = {
  manual:              'Manual',
  automatic:           'Automatic',
  'clutchless manual': 'Clutchless Manual',
  'clutchless-manual': 'Clutchless Manual',
  imt:                 'Clutchless Manual',
  cvt:                 'CVT',
  dct:                 'DCT',
};

const OWNERSHIP_MAP = {
  '1st owner':  '1st Owner',
  '2nd owner':  '2nd Owner',
  '3rd owner':  '3rd Owner',
  '4th+ owner': '4th+ Owner',
};

const INSURANCE_TYPE_MAP = {
  comprehensive: 'Comprehensive',
  'third party': 'Third Party',
  'not insured': 'Not Insured',
};

const BODY_TYPE_MAP = {
  'sedan':        'Sedan',
  'hatchback':    'Hatchback',
  'suv':          'SUV',
  'muv':          'MUV',
  'estate':       'Estate',
  'crossover':    'Crossover',
  'coupe':        'Coupe',
  'convertible':  'Convertible',
  'pickup':       'Pickup',
  'van minivan':  'Van Minivan',
  'wagon':        'Wagon',
  'sports car':   'Sports Car',
  'notchback':    'Notchback',
  'sports sedan': 'Sports Sedan',
  'others':       'Others',
};

const BOARD_TYPE_MAP = {
  'own board':  'Own Board',
  't-board':    'T-Board',
  'commercial': 'Commercial',
};

/**
 * Maps validated car data to DB fields
 */
const mapToDbValues = (data) => {
  if (!data) return {};
  const mapped = { ...data };

  if (data.kmdriven !== undefined && mapped.km_driven === undefined) {
    mapped.km_driven = data.kmdriven;
  }
  if (data.fueltype !== undefined && mapped.fuel_type === undefined) {
    mapped.fuel_type = data.fueltype;
  }
  if (data.car_type !== undefined && mapped.body_type === undefined) {
    mapped.body_type = data.car_type;
  }
  if (data.numplate !== undefined && mapped.board_type === undefined) {
    mapped.board_type = data.numplate;
  }
  if (data.numberplate !== undefined && mapped.number_plate === undefined) {
    mapped.number_plate = data.numberplate;
  }
  if (data.prior_appointments !== undefined && mapped.prior_appointemnts === undefined) {
    mapped.prior_appointemnts = data.prior_appointments;
  }

  const rawFuel = (mapped.fuel_type || '').toString().toLowerCase();
  if (rawFuel && FUEL_TYPE_MAP[rawFuel]) mapped.fuel_type = FUEL_TYPE_MAP[rawFuel];

  const rawTrans = (mapped.transmission || '').toString().toLowerCase();
  if (rawTrans && TRANSMISSION_MAP[rawTrans]) mapped.transmission = TRANSMISSION_MAP[rawTrans];

  const rawOwn = (mapped.ownership || '').toString().toLowerCase();
  if (rawOwn && OWNERSHIP_MAP[rawOwn]) mapped.ownership = OWNERSHIP_MAP[rawOwn];

  const rawIns = (mapped.insurance_type || mapped.insuranceType || '').toString().toLowerCase();
  if (rawIns && INSURANCE_TYPE_MAP[rawIns]) mapped.insurance_type = INSURANCE_TYPE_MAP[rawIns];

  const rawBody = (mapped.body_type || '').toString().toLowerCase();
  if (rawBody && BODY_TYPE_MAP[rawBody]) mapped.body_type = BODY_TYPE_MAP[rawBody];

  if (data.b2b !== undefined && mapped.b2b_listing === undefined) {
    mapped.b2b_listing = data.b2b === true || data.b2b === 'true' || data.b2b === 1 || data.b2b === '1';
  }
  if (mapped.b2b_listing !== undefined) {
    mapped.b2b_listing = mapped.b2b_listing === true || mapped.b2b_listing === 'true' || mapped.b2b_listing === 1 || mapped.b2b_listing === '1';
  }

  const rawBoard = (mapped.board_type || '').toString().trim().toLowerCase();
  if (rawBoard === 'b2b') {
    mapped.b2b_listing = true;
    mapped.board_type = 'Own Board';
  } else if (rawBoard && BOARD_TYPE_MAP[rawBoard]) {
    mapped.board_type = BOARD_TYPE_MAP[rawBoard];
  }

  return mapped;
};

/**
 * Get Cars Query Filter Schema
 */
const carQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').optional(),
  brands: Joi.string().optional(),
  models: Joi.string().optional(),
  min_year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  max_year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  min_km: Joi.number().min(0).optional(),
  max_km: Joi.number().min(0).optional(),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  fuel_types: Joi.string().optional(),
  body_types: Joi.string().optional(),
  ownerships: Joi.string().optional(),
  transmissions: Joi.string().optional(),
  posted_within_days: Joi.number().integer().min(1).max(90).optional(),
  include_expired: Joi.boolean().optional(),
  brand_id: Joi.string().uuid().optional(),
  brand: Joi.string().optional(),
  model_id: Joi.string().uuid().optional(),
  model_ids: Joi.string().optional(),
  model: Joi.string().optional(),
  variant_id: Joi.string().uuid().optional(),
  variant_ids: Joi.string().optional(),
  variant: Joi.string().optional(),
  fuel_type: Joi.string().optional(),
  transmission: Joi.string().optional(),
  state_id: Joi.string().uuid().optional(),
  district_id: Joi.string().uuid().optional(),
  city_id: Joi.string().uuid().optional(),
  posted_by_type: Joi.string().optional(),
  b2b_listing: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  body_type: Joi.string().optional(),
  board_type: Joi.string().optional(),
  status: Joi.string().optional()
}).unknown(true);

const sellCarSchema = Joi.object({}).unknown(true);

module.exports = {
  createCarSchema,
  updateCarSchema,
  mapToDbValues,
  carQuerySchema,
  sellCarSchema,
};