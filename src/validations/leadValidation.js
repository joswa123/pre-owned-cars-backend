const Joi = require('joi');

const createLeadSchema = Joi.object({
  car_id: Joi.string().uuid().optional().messages({
    'string.base': 'car_id must be a string',
    'string.guid': 'car_id must be a valid UUID',
  }),
  target_id: Joi.string().uuid().optional().messages({
    'string.base': 'target_id must be a string',
    'string.guid': 'target_id must be a valid UUID',
  }),
  target_type: Joi.string().valid('car', 'commercial').optional().default('car'),
  user_id: Joi.string().uuid().optional().messages({
    'string.guid': 'user_id must be a valid UUID',
  }),
  source: Joi.string()
    .valid('whatsapp', 'call', 'message')
    .optional()
    .default('message')
    .messages({
      'any.only': 'source must be one of: whatsapp, call, message',
    }),
  name: Joi.string().max(100).optional().allow('', null),
  phone: Joi.string().max(20).optional().allow('', null),
  contact_phone: Joi.string().max(20).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  message: Joi.string().max(1000).optional().allow('', null),
}).or('car_id', 'target_id').unknown(true);

const updateLeadStatusSchema = Joi.object({
  status: Joi.string()
    .valid('new', 'contacted', 'closed')
    .required()
    .messages({
      'any.only': 'status must be one of: new, contacted, closed',
      'any.required': 'status is required',
    }),
});

const leadQuerySchema = Joi.object({
  status: Joi.string().valid('new', 'contacted', 'closed').optional(),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  seller_id: Joi.string().uuid().optional(),
  car_id: Joi.string().uuid().optional(),
  target_id: Joi.string().uuid().optional(),
  target_type: Joi.string().valid('car', 'commercial').optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  search: Joi.string().optional(),
}).unknown(true);

module.exports = {
  createLeadSchema,
  updateLeadStatusSchema,
  leadQuerySchema,
};
