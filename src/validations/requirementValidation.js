const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.string().uuid(),
  Joi.number().integer().positive(),
  Joi.string().regex(/^\d+$/)
);

const createRequirementSchema = Joi.object({
  brand_id: idSchema.required(),
  model_id: idSchema.required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  min_price: Joi.number().min(0).optional().allow(null, ''),
  max_price: Joi.number().min(0).optional().allow(null, ''),
  min_km: Joi.number().integer().min(0).optional().allow(null, ''),
  max_km: Joi.number().integer().min(0).optional().allow(null, ''),
  body_type: Joi.string().trim().max(50).required(),
  transmission: Joi.string().trim().max(50).required(),
  board_type: Joi.string().trim().max(50).required(),
  color: Joi.string().trim().max(50).optional().allow(null, ''),
  purchase_plan_days: Joi.number().integer().min(1).max(365).required(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
})
  .custom((value, helpers) => {
    if (
      value.min_price !== undefined && value.min_price !== null && value.min_price !== '' &&
      value.max_price !== undefined && value.max_price !== null && value.max_price !== ''
    ) {
      if (Number(value.min_price) > Number(value.max_price)) {
        return helpers.message('min_price cannot be greater than max_price');
      }
    }
    if (
      value.min_km !== undefined && value.min_km !== null && value.min_km !== '' &&
      value.max_km !== undefined && value.max_km !== null && value.max_km !== ''
    ) {
      if (Number(value.min_km) > Number(value.max_km)) {
        return helpers.message('min_km cannot be greater than max_km');
      }
    }
    return value;
  })
  .unknown(true);

const updateRequirementStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'expired', 'bought', 'deleted').required(),
  bought_from: Joi.string().trim().when('status', {
    is: 'bought',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
}).unknown(true);

const updateRequirementSchema = Joi.object({
  brand_id: idSchema.optional(),
  model_id: idSchema.optional(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  min_price: Joi.number().min(0).optional().allow(null, ''),
  max_price: Joi.number().min(0).optional().allow(null, ''),
  min_km: Joi.number().integer().min(0).optional().allow(null, ''),
  max_km: Joi.number().integer().min(0).optional().allow(null, ''),
  body_type: Joi.string().trim().max(50).optional(),
  transmission: Joi.string().trim().max(50).optional(),
  board_type: Joi.string().trim().max(50).optional(),
  color: Joi.string().trim().max(50).optional().allow(null, ''),
  purchase_plan_days: Joi.number().integer().min(1).max(365).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
})
  .min(1)
  .custom((value, helpers) => {
    if (
      value.min_price !== undefined && value.min_price !== null && value.min_price !== '' &&
      value.max_price !== undefined && value.max_price !== null && value.max_price !== ''
    ) {
      if (Number(value.min_price) > Number(value.max_price)) {
        return helpers.message('min_price cannot be greater than max_price');
      }
    }
    if (
      value.min_km !== undefined && value.min_km !== null && value.min_km !== '' &&
      value.max_km !== undefined && value.max_km !== null && value.max_km !== ''
    ) {
      if (Number(value.min_km) > Number(value.max_km)) {
        return helpers.message('min_km cannot be greater than max_km');
      }
    }
    return value;
  })
  .unknown(true);

module.exports = {
  createRequirementSchema,
  updateRequirementSchema,
  updateRequirementStatusSchema,
};
