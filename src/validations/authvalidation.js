const Joi = require('joi');

const registerSchema = Joi.object({
  full_name: Joi.string().min(3).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('buyer', 'seller', 'company_seller').default('buyer'),
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

module.exports = {
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
};