const Joi = require('joi');

const registerSchema = Joi.object({
  full_name: Joi.string().min(3).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().min(8).max(20).required(),
  role: Joi.string().valid('customer', 'dealer', 'buyer', 'seller', 'company_seller').default('customer'),
  email: Joi.string().email().optional().allow('', null),
  
  // Location fields (IDs or names)
  state_id: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
  district_id: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
  city_id: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
  state: Joi.string().max(100).optional().allow('', null),
  city: Joi.string().max(100).optional().allow('', null),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).optional().allow('', null),
  address: Joi.string().optional().allow('', null),

  // Dealer-specific fields (optional at registration)
  company_name: Joi.string().max(100).optional().allow('', null),
  license_no: Joi.string().max(100).optional().allow('', null),
  gst_no: Joi.string().max(100).optional().allow('', null),
  contact_person: Joi.string().max(100).optional().allow('', null),
  seller_type: Joi.string().valid('individual', 'company', 'private', 'dealer').optional().allow('', null),
  door_no: Joi.string().max(50).optional().allow('', null),
  building_name: Joi.string().max(100).optional().allow('', null),
  street_name: Joi.string().max(100).optional().allow('', null),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  otp: Joi.string().length(6).pattern(/^[0-9]{6}$/).required(),
});

const resendOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
});

const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().required(),
});
const forgotPasswordSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
});

const resetPasswordSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  otp: Joi.string().length(6).pattern(/^[0-9]{6}$/).required(),
  newPassword: Joi.string().min(6).required(),
});

module.exports = {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};