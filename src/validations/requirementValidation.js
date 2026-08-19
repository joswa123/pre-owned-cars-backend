const Joi = require('joi');

const createRequirementSchema = Joi.object({
  brand_id: Joi.string().uuid().required(),
  model_id: Joi.string().uuid().required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  price: Joi.number().min(0).optional().allow(null, ''),
  km_driven: Joi.number().integer().min(0).optional().allow(null, ''),
  km: Joi.number().integer().min(0).optional().allow(null, ''),
  body_type: Joi.string().trim().max(50).required(),
  transmission: Joi.string().trim().max(50).required(),
  board_type: Joi.string().trim().max(50).required(),
  color: Joi.string().trim().max(50).optional().allow(null, ''),
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

const updateRequirementSchema = Joi.object({
  brand_id: Joi.string().uuid().optional(),
  model_id: Joi.string().uuid().optional(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  price: Joi.number().min(0).optional().allow(null, ''),
  km_driven: Joi.number().integer().min(0).optional().allow(null, ''),
  km: Joi.number().integer().min(0).optional().allow(null, ''),
  body_type: Joi.string().trim().max(50).optional(),
  transmission: Joi.string().trim().max(50).optional(),
  board_type: Joi.string().trim().max(50).optional(),
  color: Joi.string().trim().max(50).optional().allow(null, ''),
  purchase_plan_days: Joi.number().integer().min(1).max(365).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
}).min(1).unknown(true);

module.exports = {
  createRequirementSchema,
  updateRequirementSchema,
  updateRequirementStatusSchema,
};
