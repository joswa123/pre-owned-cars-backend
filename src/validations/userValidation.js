const Joi = require('joi');

const updateProfileSchema = Joi.object({
  // User fields
  full_name: Joi.string().min(2).max(100).optional(),
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  profile_picture: Joi.string().uri().optional(),
  email: Joi.string().email().optional(),
  use_registered_for_whatsapp: Joi.boolean().optional(),
  whatsapp_number: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
  
  // Dealer/Customer specific fields
  company_name: Joi.string().max(100).optional(),
  door_no: Joi.string().max(50).optional(),
  building_name: Joi.string().max(100).optional(),
  street_name: Joi.string().max(100).optional(),
  pincode: Joi.string().pattern(/^[0-9]{5,10}$/).optional(),
  alt_phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
  
  // Customer specific
  preferences: Joi.object().optional(),

  // Legacy fields
  seller_type: Joi.string().valid('individual', 'company').optional(),
  address: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  license_no: Joi.string().max(100).optional(),
  gst_no: Joi.string().max(100).optional(),
  contact_person: Joi.string().max(100).optional(),
  
  // Location IDs
  state_id: Joi.string().uuid().optional(),
  district_id: Joi.string().uuid().optional(),
  city_id: Joi.string().uuid().optional(),
  
  // Dealer specific
  aadhar_no: Joi.string().pattern(/^[0-9]{12}$/).optional(),
}).min(1);

module.exports = { updateProfileSchema };