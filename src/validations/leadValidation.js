const Joi = require('joi');

const createLeadSchema = Joi.object({
  car_id: Joi.string().uuid().required().messages({
    'string.base': 'car_id must be a string',
    'string.guid': 'car_id must be a valid UUID',
    'any.required': 'car_id is required',
  }),
  message: Joi.string().max(400).optional().allow('', null).messages({
    'string.max': 'message must not exceed 400 characters',
  }),
  contact_phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'contact_phone must be a valid 10-15 digit phone number',
    }),
  preferred_contact: Joi.string()
    .valid('whatsapp', 'phone', 'email')
    .optional()
    .default('phone')
    .messages({
      'any.only': 'preferred_contact must be one of: whatsapp, phone, email',
    }),
  source: Joi.string()
    .valid('call', 'whatsapp', 'message', 'chat')
    .optional()
    .default('message')
    .messages({
      'any.only': 'source must be one of: call, whatsapp, message, chat',
    }),
}).unknown(true);

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
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  search: Joi.string().optional(),
}).unknown(true);

module.exports = {
  createLeadSchema,
  updateLeadStatusSchema,
  leadQuerySchema,
};
