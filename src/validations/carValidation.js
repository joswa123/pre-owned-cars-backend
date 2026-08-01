const Joi = require('joi');

const FUEL_TYPES_IN         = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'];
const TRANSMISSION_TYPES_IN = ['manual', 'automatic', 'cvt', 'dct'];
const OWNERSHIP_TYPES_IN    = ['1st owner', '2nd owner', '3rd owner', '4th+ owner'];
const INSURANCE_TYPE_IN     = ['comprehensive', 'third party', 'not insured'];

const enumString = (values) =>
  Joi.string().trim().lowercase().valid(...values);

/**
 * Create Car Joi Schema
 */
const createCarSchema = Joi.object({
  brand:            Joi.string().trim().max(50).required(),
  model:            Joi.string().trim().max(50).required(),
  variant:          Joi.string().trim().max(50).required(),
  year:             Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  price:            Joi.number().positive().required(),
  price_negotiable: Joi.boolean().default(false),
  km_driven:        Joi.number().integer().min(0).optional(),
  kmdriven:         Joi.number().integer().min(0).optional(),
  fuel_type:        enumString(FUEL_TYPES_IN).optional(),
  fueltype:         enumString(FUEL_TYPES_IN).optional(),
  transmission:     enumString(TRANSMISSION_TYPES_IN).required(),
  ownership:        enumString(OWNERSHIP_TYPES_IN).required(),
  body_type:        Joi.string().trim().max(50).optional(),
  car_type:         Joi.string().trim().max(50).optional(),
  board_type:       Joi.string().trim().max(50).optional(),
  numplate:         Joi.string().trim().max(50).optional(),
  insurance_expiry_date: Joi.date().iso().allow('', null).optional(),
  insurance_type:   enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  insuranceType:    enumString(INSURANCE_TYPE_IN).allow('', null).optional(),
  b2b_listing:      Joi.boolean().default(false),
  engine_cc:        Joi.number().integer().min(0).allow('', null).optional(),
  description:      Joi.string().trim().allow('', null).optional(),
}).or('km_driven', 'kmdriven')
  .or('fuel_type', 'fueltype')
  .or('body_type', 'car_type')
  .or('board_type', 'numplate')
  .unknown(true);

/**
 * Update Car Joi Schema
 */
const updateCarSchema = Joi.object({
  brand:            Joi.string().trim().max(50),
  model:            Joi.string().trim().max(50),
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
  board_type:       Joi.string().trim().max(50),
  numplate:         Joi.string().trim().max(50),
  insurance_expiry_date: Joi.date().iso().allow('', null),
  insurance_type:   enumString(INSURANCE_TYPE_IN).allow('', null),
  insuranceType:    enumString(INSURANCE_TYPE_IN).allow('', null),
  b2b_listing:      Joi.boolean(),
  is_available:     Joi.boolean(),
  engine_cc:        Joi.number().integer().min(0).allow('', null),
  description:      Joi.string().trim().allow('', null),
}).unknown(true).min(1);

// DB Mapping Helpers
const FUEL_TYPE_MAP = {
  petrol:   'Petrol',
  diesel:   'Diesel',
  electric: 'Electric',
  hybrid:   'Hybrid',
  cng:      'CNG',
};

const TRANSMISSION_MAP = {
  manual:    'Manual',
  automatic: 'Automatic',
  cvt:       'CVT',
  dct:       'DCT',
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

  const rawFuel = (mapped.fuel_type || '').toString().toLowerCase();
  if (rawFuel && FUEL_TYPE_MAP[rawFuel]) mapped.fuel_type = FUEL_TYPE_MAP[rawFuel];

  const rawTrans = (mapped.transmission || '').toString().toLowerCase();
  if (rawTrans && TRANSMISSION_MAP[rawTrans]) mapped.transmission = TRANSMISSION_MAP[rawTrans];

  const rawOwn = (mapped.ownership || '').toString().toLowerCase();
  if (rawOwn && OWNERSHIP_MAP[rawOwn]) mapped.ownership = OWNERSHIP_MAP[rawOwn];

  const rawIns = (mapped.insurance_type || mapped.insuranceType || '').toString().toLowerCase();
  if (rawIns && INSURANCE_TYPE_MAP[rawIns]) mapped.insurance_type = INSURANCE_TYPE_MAP[rawIns];

  return mapped;
};

module.exports = {
  createCarSchema,
  updateCarSchema,
  mapToDbValues,
};