const Joi = require('joi');

const CAR_TYPES = [
  'SUV',
  'Sedan',
  'Hatchback',
  'MUV',
  'Coupe',
  'Convertible',
  'Pickup',
  'Van',
];

const createCarSchema = Joi.object({
  brand: Joi.string().max(50).required(),
  model: Joi.string().max(50).required(),
  variant: Joi.string().max(50).required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  purchasedate: Joi.date().iso().required(),
  numplate: Joi.string().max(20).required(),
  price: Joi.number().positive().required(),
  price_negotiable: Joi.boolean().default(false),
  exteriorColour: Joi.string().max(30).required(),
  interiorColour: Joi.string().max(30).required(),
  kmdriven: Joi.number().integer().min(0).required(),
  fueltype: Joi.string().valid('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG').required(),
  transmission: Joi.string().valid('Manual', 'Automatic', 'CVT', 'DCT').required(),
  ownership: Joi.string().valid('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner').required(),
  state: Joi.string().max(100).required(),
  city: Joi.string().max(100).required(),
  car_type: Joi.string().valid(...CAR_TYPES).required(),
  description: Joi.string().allow('', null).optional(),
}).unknown(false);

// All fields optional for partial updates (PUT/PATCH)
const updateCarSchema = Joi.object({
  brand: Joi.string().max(50),
  model: Joi.string().max(50),
  variant: Joi.string().max(50),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1),
  purchasedate: Joi.date().iso(),
  numplate: Joi.string().max(20),
  price: Joi.number().positive(),
  price_negotiable: Joi.boolean(),
  exteriorColour: Joi.string().max(30),
  interiorColour: Joi.string().max(30),
  kmdriven: Joi.number().integer().min(0),
  fueltype: Joi.string().valid('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'),
  transmission: Joi.string().valid('Manual', 'Automatic', 'CVT', 'DCT'),
  ownership: Joi.string().valid('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner'),
  state: Joi.string().max(100),
  city: Joi.string().max(100),
  car_type: Joi.string().valid(...CAR_TYPES),
  description: Joi.string().allow('', null).optional(),
}).unknown(false).min(1); // at least one field must be provided

module.exports = { createCarSchema, updateCarSchema };