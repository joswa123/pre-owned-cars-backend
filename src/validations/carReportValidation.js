const Joi = require('joi');

const REPORT_REASONS = [
  'car_sold_out',
  'overpriced_car',
  'incorrect_info',
  'seller_not_contactable',
  'dealer_listed_as_individual',
  'fraudulent_listing',
  'requesting_money_before_seeing',
  'other',
];

const REPORT_STATUSES = ['pending', 'in_review', 'resolved', 'dismissed'];

const createCarReportSchema = Joi.object({
  car_id: Joi.string().uuid().required(),
  dealer_id: Joi.string().uuid().optional(),
  reason: Joi.string().valid(...REPORT_REASONS).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  // Optional overrides for guests
  reporter_name: Joi.string().trim().max(100).optional(),
  reporter_phone: Joi.string().trim().pattern(/^[0-9]{10,15}$/).optional(),
}).unknown(false);

const updateCarReportStatusSchema = Joi.object({
  status: Joi.string().valid(...REPORT_STATUSES).optional(),
  admin_notes: Joi.string().trim().allow('', null).optional(),
}).min(1).unknown(false);

const carReportQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid(...REPORT_STATUSES).optional(),
  car_id: Joi.string().uuid().optional(),
  dealer_id: Joi.string().uuid().optional(),
  reason: Joi.string().valid(...REPORT_REASONS).optional(),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').optional(),
}).unknown(true);

module.exports = {
  REPORT_REASONS,
  REPORT_STATUSES,
  createCarReportSchema,
  updateCarReportStatusSchema,
  carReportQuerySchema,
};
