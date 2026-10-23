'use strict';

const Joi = require('joi');

const SAFE_HTTP_URL_REGEX = /^https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.)[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/i;

/**
 * Validation schema for creating a car type / category
 */
const createCarTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .replace(/\s+/g, ' ')
    .min(1)
    .max(50)
    .pattern(/^[^\x00-\x1F\x7F]+$/)
    .required()
    .messages({
      'string.base': 'Category name must be a string.',
      'string.empty': 'Category name cannot be empty.',
      'string.min': 'Category name cannot be empty.',
      'string.max': 'Category name cannot exceed 50 characters.',
      'string.pattern.base': 'Category name contains invalid control characters.',
      'any.required': 'Category name is required.',
    }),
  slug: Joi.string()
    .trim()
    .max(70)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .messages({
      'string.pattern.base': 'Slug must be lowercase alphanumeric with optional single hyphens.',
    }),
  icon_url: Joi.string()
    .trim()
    .max(500)
    .regex(SAFE_HTTP_URL_REGEX)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'icon_url must be a valid public HTTP or HTTPS URL (internal hosts and javascript schemes disallowed).',
    }),
  order: Joi.number()
    .integer()
    .min(0)
    .max(99999)
    .optional()
    .messages({
      'number.base': 'order must be a valid integer.',
      'number.integer': 'order must be a valid integer.',
      'number.min': 'order cannot be negative.',
    }),
  is_active: Joi.boolean().optional().messages({
    'boolean.base': 'is_active must be a boolean.',
  }),
}).options({ allowUnknown: true });

/**
 * Validation schema for updating a car type / category (Admin - PUT)
 */
const updateCarTypeSchema = Joi.object({
  name: Joi.string()
    .trim()
    .replace(/\s+/g, ' ')
    .min(1)
    .max(50)
    .pattern(/^[^\x00-\x1F\x7F]+$/)
    .optional()
    .messages({
      'string.empty': 'Category name cannot be empty.',
      'string.min': 'Category name cannot be empty.',
      'string.max': 'Category name cannot exceed 50 characters.',
      'string.pattern.base': 'Category name contains invalid control characters.',
    }),
  slug: Joi.string()
    .trim()
    .max(70)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .messages({
      'string.pattern.base': 'Slug must be lowercase alphanumeric with optional single hyphens.',
    }),
  icon_url: Joi.string()
    .trim()
    .max(500)
    .regex(SAFE_HTTP_URL_REGEX)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'icon_url must be a valid public HTTP or HTTPS URL (internal hosts and javascript schemes disallowed).',
    }),
  order: Joi.number()
    .integer()
    .min(0)
    .max(99999)
    .optional()
    .messages({
      'number.base': 'order must be a valid integer.',
      'number.integer': 'order must be a valid integer.',
      'number.min': 'order cannot be negative.',
    }),
  is_active: Joi.boolean().optional().messages({
    'boolean.base': 'is_active must be a boolean.',
  }),
}).options({ allowUnknown: true });

module.exports = {
  createCarTypeSchema,
  updateCarTypeSchema,
};
