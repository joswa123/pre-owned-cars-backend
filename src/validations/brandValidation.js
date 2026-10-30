'use strict';

const Joi = require('joi');

/**
 * Validation schema for creating a brand
 * POST /api/v1/admin/brands or POST /api/v1/catalog/brands
 */
const brandSchema = Joi.object({
  name: Joi.string()
    .trim()
    .max(100)
    .required()
    .messages({
      'string.empty': 'Brand name cannot be empty.',
      'any.required': 'Brand name is required.',
    }),
  slug: Joi.string()
    .trim()
    .max(120)
    .optional(),
  type_id: Joi.string()
    .trim()
    .max(36)
    .allow('', null)
    .optional(),
  type_ids: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(36)),
    Joi.string().trim()
  ).optional(),
  is_active: Joi.boolean()
    .optional()
    .default(true),
  external_id: Joi.number()
    .integer()
    .optional(),
}).options({ allowUnknown: true });

/**
 * Validation schema for updating a brand
 * PUT /api/v1/admin/brands/:id
 */
const brandUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .max(100)
    .optional(),
  slug: Joi.string()
    .trim()
    .max(120)
    .optional(),
  type_id: Joi.string()
    .trim()
    .max(36)
    .allow('', null)
    .optional(),
  type_ids: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(36)),
    Joi.string().trim()
  ).optional(),
  is_active: Joi.boolean()
    .optional(),
  external_id: Joi.number()
    .integer()
    .optional(),
}).options({ allowUnknown: true });

module.exports = {
  brandSchema,
  brandUpdateSchema,
};