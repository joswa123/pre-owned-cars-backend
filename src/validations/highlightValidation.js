'use strict';

const Joi = require('joi');

/**
 * Validation schema for creating a new highlight (Admin)
 */
const createHighlightSchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Highlight name is required.',
    'string.max': 'Highlight name cannot exceed 100 characters.',
    'any.required': 'Highlight name is required.',
  }),
  is_active: Joi.boolean().optional(),
}).options({ allowUnknown: false }).messages({
  'object.unknown': 'Unknown field provided in create highlight request.',
});

/**
 * Validation schema for updating an existing highlight (Admin - PUT)
 */
const updateHighlightSchema = Joi.object({
  name: Joi.string().trim().max(100).optional().messages({
    'string.empty': 'Highlight name cannot be empty.',
    'string.max': 'Highlight name cannot exceed 100 characters.',
  }),
  is_active: Joi.boolean().optional(),
}).min(1).options({ allowUnknown: false }).messages({
  'object.min': 'At least one field (name or is_active) must be provided for update.',
  'object.unknown': 'Unknown field provided in update highlight request.',
});

/**
 * Validation schema for patching an existing highlight status (Admin - PATCH)
 * Whitelist: ONLY is_active allowed
 */
const patchHighlightSchema = Joi.object({
  is_active: Joi.boolean().required().messages({
    'boolean.base': 'is_active must be a boolean.',
    'any.required': 'is_active is required.',
  }),
}).options({ allowUnknown: false }).messages({
  'object.unknown': 'Only is_active can be updated via PATCH.',
});

module.exports = {
  createHighlightSchema,
  updateHighlightSchema,
  patchHighlightSchema,
};
