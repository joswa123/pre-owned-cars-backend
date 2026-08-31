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
});

/**
 * Validation schema for updating an existing highlight (Admin)
 */
const updateHighlightSchema = Joi.object({
  name: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Highlight name cannot exceed 100 characters.',
  }),
  is_active: Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'At least one field (name or is_active) must be provided for update.',
});

module.exports = {
  createHighlightSchema,
  updateHighlightSchema,
};
