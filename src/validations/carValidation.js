const Joi = require('joi');

// ─── Canonical Value Sets (single source of truth) ──────────────────────────
// These values MUST match the MySQL ENUM definitions in Car.js exactly.
// MySQL ENUMs are case-sensitive – these are the stored DB values.

const CAR_TYPES = [
  'suv',
  'sedan',
  'hatchback',
  'muv',
  'coupe',
  'convertible',
  'pickup',
  'van',
];

// Note: fuel_type, transmission, ownership are stored as mixed-case in MySQL ENUM.
// The service layer (createCar / updateCar) maps incoming lowercase → DB mixed-case.
const FUEL_TYPES_IN       = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'];
const TRANSMISSION_TYPES_IN = ['manual', 'automatic', 'cvt', 'dct'];
const OWNERSHIP_TYPES_IN  = ['1st owner', '2nd owner', '3rd owner', '4th+ owner'];

// ─── Reusable Helpers ────────────────────────────────────────────────────────
// Accepts any casing from client, trims whitespace, lowercases, then validates.
const enumString = (values) =>
  Joi.string().trim().lowercase().valid(...values);

// ─── Create Car Schema ───────────────────────────────────────────────────────
const createCarSchema = Joi.object({
  brand:            Joi.string().trim().max(50).required(),
  model:            Joi.string().trim().max(50).required(),
  variant:          Joi.string().trim().max(50).required(),
  year:             Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  purchasedate:     Joi.date().iso().required(),
  numplate:         Joi.string().trim().max(20).required(),
  price:            Joi.number().positive().required(),
  price_negotiable: Joi.boolean().default(false),
  exteriorColour:   Joi.string().trim().max(30).required(),
  interiorColour:   Joi.string().trim().max(30).required(),
  kmdriven:         Joi.number().integer().min(0).required(),
  fueltype:         enumString(FUEL_TYPES_IN).required(),
  transmission:     enumString(TRANSMISSION_TYPES_IN).required(),
  ownership:        enumString(OWNERSHIP_TYPES_IN).required(),
  state:            Joi.string().trim().max(100).required(),
  city:             Joi.string().trim().max(100).required(),
  car_type:         enumString(CAR_TYPES).required(),
  description:      Joi.string().trim().allow('', null).optional(),
}).unknown(false);

// ─── Update Car Schema (all fields optional, but at least one required) ──────
const updateCarSchema = Joi.object({
  brand:            Joi.string().trim().max(50),
  model:            Joi.string().trim().max(50),
  variant:          Joi.string().trim().max(50),
  year:             Joi.number().integer().min(1900).max(new Date().getFullYear() + 1),
  purchasedate:     Joi.date().iso(),
  numplate:         Joi.string().trim().max(20),
  price:            Joi.number().positive(),
  price_negotiable: Joi.boolean(),
  exteriorColour:   Joi.string().trim().max(30),
  interiorColour:   Joi.string().trim().max(30),
  kmdriven:         Joi.number().integer().min(0),
  fueltype:         enumString(FUEL_TYPES_IN),
  transmission:     enumString(TRANSMISSION_TYPES_IN),
  ownership:        enumString(OWNERSHIP_TYPES_IN),
  state:            Joi.string().trim().max(100),
  city:             Joi.string().trim().max(100),
  car_type:         enumString(CAR_TYPES),
  description:      Joi.string().trim().allow('', null).optional(),
}).unknown(false).min(1);

// ─── DB Mapping Helpers (use in service layer) ───────────────────────────────
// Maps validated lowercase Joi output → MySQL ENUM values stored in the DB.
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

const CAR_TYPE_MAP = {
  suv:         'SUV',
  sedan:       'Sedan',
  hatchback:   'Hatchback',
  muv:         'MUV',
  coupe:       'Coupe',
  convertible: 'Convertible',
  pickup:      'Pickup',
  van:         'Van',
};

/**
 * Maps a validated (lowercase) car data object to DB-compatible mixed-case enum values.
 * Call this in the service before Car.create() / car.update().
 *
 * @param {object} data - Validated carData from Joi
 * @returns {object} - data with enum fields mapped to DB values
 */
const mapToDbValues = (data) => {
  const mapped = { ...data };
  if (data.fueltype)     mapped.fueltype     = FUEL_TYPE_MAP[data.fueltype]     ?? data.fueltype;
  if (data.transmission) mapped.transmission = TRANSMISSION_MAP[data.transmission] ?? data.transmission;
  if (data.ownership)    mapped.ownership    = OWNERSHIP_MAP[data.ownership]    ?? data.ownership;
  if (data.car_type)     mapped.car_type     = CAR_TYPE_MAP[data.car_type]      ?? data.car_type;
  return mapped;
};

module.exports = {
  createCarSchema,
  updateCarSchema,
  mapToDbValues,
  FUEL_TYPE_MAP,
  TRANSMISSION_MAP,
  OWNERSHIP_MAP,
  CAR_TYPE_MAP,
};