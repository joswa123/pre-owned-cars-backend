const Joi = require('joi');

const createRequirementSchema = Joi.object({
  brand_id: Joi.string().uuid().required(),
  model_id: Joi.string().uuid().optional().allow(null, ''),
  min_year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  max_year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  min_price: Joi.number().min(0).optional().allow(null, ''),
  max_price: Joi.number().min(0).optional().allow(null, ''),
  min_km: Joi.number().integer().min(0).optional().allow(null, ''),
  max_km: Joi.number().integer().min(0).optional().allow(null, ''),
  body_type: Joi.string().trim().max(50).optional().allow(null, ''),
  transmission: Joi.string().trim().max(50).optional().allow(null, ''),
  board_type: Joi.string().trim().max(50).optional().allow(null, ''),
  purchase_plan_days: Joi.number().integer().min(1).max(365).required(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
}).unknown(true);

const updateRequirementStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'expired', 'bought', 'deleted').required(),
  bought_from: Joi.string().trim().when('status', {
    is: 'bought',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
}).unknown(true);

module.exports = {
  createRequirementSchema,
  updateRequirementStatusSchema,
};
