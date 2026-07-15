const Joi = require('joi');

const updateProfileSchema = Joi.object({
  full_name: Joi.string().max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  email: Joi.string().email().optional(),
  aadhaar: Joi.string().pattern(/^[0-9]{12}$/).optional(),
  role: Joi.string().valid('buyer', 'seller', 'admin').optional(),
  seller_type: Joi.string().valid('individual', 'company').optional(),
  address: Joi.string().optional(),
  city_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
  state_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).optional(),
  profile_picture: Joi.string().max(255).allow(null, '').optional()
});

module.exports = { updateProfileSchema };