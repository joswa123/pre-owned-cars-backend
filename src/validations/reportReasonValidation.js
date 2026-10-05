'use strict';

const Joi = require('joi');

const createReportReasonSchema = Joi.object({
  label: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Label is required and cannot be empty',
    'any.required': 'Label is required',
    'string.max': 'Label cannot exceed 100 characters',
  }),
  value: Joi.string().trim().max(60).pattern(/^[a-z0-9]+(_[a-z0-9]+)*$/).required().messages({
    'string.empty': 'Value is required and cannot be empty',
    'any.required': 'Value is required',
    'string.pattern.base': 'Value must be lowercase snake_case (e.g., car_sold_out)',
    'string.max': 'Value cannot exceed 60 characters',
  }),
  isActive: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).unknown(false);

const updateReportReasonSchema = Joi.object({
  label: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Label cannot be empty',
    'string.max': 'Label cannot exceed 100 characters',
  }),
  value: Joi.string().trim().max(60).pattern(/^[a-z0-9]+(_[a-z0-9]+)*$/).optional().messages({
    'string.empty': 'Value cannot be empty',
    'string.pattern.base': 'Value must be lowercase snake_case (e.g., car_sold_out)',
    'string.max': 'Value cannot exceed 60 characters',
  }),
  isActive: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1).unknown(false);

const queryReportReasonSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  search: Joi.string().trim().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
}).unknown(true);

module.exports = {
  createReportReasonSchema,
  updateReportReasonSchema,
  queryReportReasonSchema,
};
