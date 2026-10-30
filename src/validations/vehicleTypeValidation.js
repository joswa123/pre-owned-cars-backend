'use strict';

const Joi = require('joi');

const SAFE_HTTP_URL_REGEX = /^https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.)[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/i;

/**
 * Validation schema for creating a vehicle type
 * POST /api/v1/admin/types
 */
const createVehicleTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .replace(/\s+/g, ' ')
    .min(1)
    .max(50)
    .pattern(/^[^\x00-\x1F\x7F]+$/)
    .required()
    .messages({
      'string.base': 'Vehicle type name must be a string.',
      'string.empty': 'Vehicle type name cannot be empty.',
      'string.min': 'Vehicle type name cannot be empty.',
      'string.max': 'Vehicle type name cannot exceed 50 characters.',
      'string.pattern.base': 'Vehicle type name contains invalid control characters.',
      'any.required': 'Vehicle type name is required.',
    }),
  slug: Joi.string()
    .trim()
    .max(70)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .messages({
      'string.pattern.base': 'Slug must be lowercase alphanumeric with optional single hyphens.',
    }),
  category_id: Joi.string()
    .trim()
    .max(36)
    .allow('', null)
    .optional(),
  icon_url: Joi.string()
    .trim()
    .max(500)
    .regex(SAFE_HTTP_URL_REGEX)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'icon_url must be a valid public HTTP or HTTPS URL.',
    }),
  order: Joi.number()
    .integer()
    .min(0)
    .max(99999)
    .optional(),
  is_active: Joi.boolean()
    .optional()
    .default(true),
}).options({ allowUnknown: true });

/**
 * Validation schema for updating a vehicle type
 * PUT /api/v1/admin/types/:id
 */
const updateVehicleTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .replace(/\s+/g, ' ')
    .min(1)
    .max(50)
    .pattern(/^[^\x00-\x1F\x7F]+$/)
    .optional(),
  slug: Joi.string()
    .trim()
    .max(70)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  category_id: Joi.string()
    .trim()
    .max(36)
    .allow('', null)
    .optional(),
  icon_url: Joi.string()
    .trim()
    .max(500)
    .regex(SAFE_HTTP_URL_REGEX)
    .allow('', null)
    .optional(),
  order: Joi.number()
    .integer()
    .min(0)
    .max(99999)
    .optional(),
  is_active: Joi.boolean()
    .optional(),
}).options({ allowUnknown: true });

module.exports = {
  createVehicleTypeSchema,
  updateVehicleTypeSchema,
};
