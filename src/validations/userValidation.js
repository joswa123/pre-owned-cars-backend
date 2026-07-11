const Joi = require('joi');

const updateProfileSchema = Joi.object({
  seller_type: Joi.string().valid('individual', 'company').required(),
  // Common fields
  name: Joi.string().min(3).max(100).optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).optional(),
  // Company-only fields
  company_name: Joi.string().max(100).when('seller_type', {
    is: 'company',
    then: Joi.required(),
  }),
  license_no: Joi.string().max(100).when('seller_type', {
    is: 'company',
    then: Joi.required(),
  }),
  gst_no: Joi.string().max(100).when('seller_type', {
    is: 'company',
    then: Joi.required(),
  }),
  contact_person: Joi.string().max(100).when('seller_type', {
    is: 'company',
    then: Joi.required(),
  }),
});

module.exports = { updateProfileSchema };