const Joi = require('joi');

/**
 * Joi Validation Schema for User & Dealer Registration
 */
const registerSchema = Joi.object({
  role: Joi.string().valid('customer', 'dealer').default('customer'),
  full_name: Joi.string().min(3).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  email: Joi.string().email().optional().allow('', null),
  password: Joi.string().min(8).max(50).required(),

  // Location fields (IDs or names allowed)
  state_id: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
  district_id: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
  city_id: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
  state: Joi.string().max(100).optional().allow('', null),
  district: Joi.string().max(100).optional().allow('', null),
  city: Joi.string().max(100).optional().allow('', null),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).optional().allow('', null),
  address: Joi.string().optional().allow('', null),

  // Conditional Dealer Fields (Required when role === 'dealer')
  company_name: Joi.when('role', {
    is: 'dealer',
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).optional().allow('', null),
  }),
  door_no: Joi.when('role', {
    is: 'dealer',
    then: Joi.string().max(50).required(),
    otherwise: Joi.string().max(50).optional().allow('', null),
  }),
  building_name: Joi.when('role', {
    is: 'dealer',
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).optional().allow('', null),
  }),
  street_name: Joi.when('role', {
    is: 'dealer',
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).optional().allow('', null),
  }),
  
  // Optional Dealer Fields
  gst_no: Joi.string().max(50).optional().allow('', null),
  license_no: Joi.string().max(100).optional().allow('', null),
  contact_person: Joi.string().max(100).optional().allow('', null),
  seller_type: Joi.string().valid('individual', 'company', 'private', 'dealer').optional().allow('', null),
}).unknown(true);

/**
 * Validation schema for email/phone verification endpoint
 */
const verifySchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  code: Joi.string().length(6).pattern(/^[0-9]{6}$/).optional(),
  otp: Joi.string().length(6).pattern(/^[0-9]{6}$/).optional(),
}).or('phone', 'email').or('code', 'otp');

const verifyOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  otp: Joi.string().length(6).pattern(/^[0-9]{6}$/).required(),
});

const resendOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
}).or('phone', 'email');

const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  password: Joi.string().required(),
}).or('phone', 'email');

const forgotPasswordSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
}).or('phone', 'email');

const resetPasswordSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  otp: Joi.string().length(6).pattern(/^[0-9]{6}$/).required(),
  newPassword: Joi.string().min(8).required(),
}).or('phone', 'email');

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

module.exports = {
  registerSchema,
  verifySchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};