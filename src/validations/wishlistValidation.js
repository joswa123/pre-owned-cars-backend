'use strict';

const Joi = require('joi');

const uuidString = Joi.string().uuid().messages({
  'string.base': 'ID must be a string',
  'string.guid': 'ID must be a valid UUID',
});

/**
 * Validation schema for POST /api/v1/wishlist and POST /api/v1/wishlist/toggle
 * Enforces target_type in ['car', 'commercial'] and requires target_id or car_id (or accepted aliases).
 */
const wishlistWriteSchema = Joi.object({
  target_id: uuidString.optional(),
  targetId: uuidString.optional(),
  car_id: uuidString.optional(),
  carId: uuidString.optional(),
  vehicle_id: uuidString.optional(),
  vehicleId: uuidString.optional(),
  commercial_id: uuidString.optional(),
  commercialId: uuidString.optional(),
  bike_id: uuidString.optional(),
  bikeId: uuidString.optional(),
  id: uuidString.optional(),
  target_type: Joi.string()
    .trim()
    .lowercase()
    .valid('car', 'commercial', 'bike')
    .optional()
    .messages({
      'any.only': 'target_type must be one of: car, commercial, bike',
    }),
  targetType: Joi.string()
    .trim()
    .lowercase()
    .valid('car', 'commercial', 'bike')
    .optional()
    .messages({
      'any.only': 'target_type must be one of: car, commercial, bike',
    }),
})
  .or('target_id', 'targetId', 'car_id', 'carId', 'vehicle_id', 'vehicleId', 'commercial_id', 'commercialId', 'bike_id', 'bikeId', 'id')
  .unknown(true)
  .messages({
    'object.missing': 'Either target_id or car_id is required',
  });

/**
 * Validation schema for GET /api/v1/wishlist
 * Legacy safeguard: defaults target_type to 'car' when omitted.
 */
const wishlistQuerySchema = Joi.object({
  target_type: Joi.string()
    .trim()
    .lowercase()
    .valid('car', 'commercial', 'bike', 'all')
    .optional()
    .default('car')
    .messages({
      'any.only': 'target_type must be one of: car, commercial, bike, all',
    }),
}).unknown(true);

/**
 * Validation schema for DELETE /api/v1/wishlist/:id
 * Combines params, query, and body so target_type can be sent via ?target_type=commercial or body.
 */
const wishlistDeleteSchema = Joi.object({
  id: uuidString.optional(),
  carId: uuidString.optional(),
  car_id: uuidString.optional(),
  target_id: uuidString.optional(),
  targetId: uuidString.optional(),
  vehicle_id: uuidString.optional(),
  vehicleId: uuidString.optional(),
  commercial_id: uuidString.optional(),
  commercialId: uuidString.optional(),
  bike_id: uuidString.optional(),
  bikeId: uuidString.optional(),
  target_type: Joi.string()
    .trim()
    .lowercase()
    .valid('car', 'commercial', 'bike')
    .optional()
    .messages({
      'any.only': 'target_type must be one of: car, commercial, bike',
    }),
  targetType: Joi.string()
    .trim()
    .lowercase()
    .valid('car', 'commercial', 'bike')
    .optional()
    .messages({
      'any.only': 'target_type must be one of: car, commercial, bike',
    }),
})
  .or('id', 'carId', 'car_id', 'target_id', 'targetId', 'vehicle_id', 'vehicleId', 'commercial_id', 'commercialId', 'bike_id', 'bikeId')
  .unknown(true)
  .messages({
    'object.missing': 'Either target_id or car_id is required',
  });

/**
 * Validation schema for seller metrics query GET /api/v1/wishlist/(car|commercial)/:id
 */
const targetWishlistsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  cursor: Joi.string().allow('', null).optional(),
}).unknown(true);

module.exports = {
  wishlistWriteSchema,
  wishlistQuerySchema,
  wishlistDeleteSchema,
  targetWishlistsQuerySchema,
};

