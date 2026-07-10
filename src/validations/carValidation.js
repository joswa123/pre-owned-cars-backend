const Joi = require('joi');

const carSchema = Joi.object({
  // Seller profile fields (will update user)
  name: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  address: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).optional(),
  aadhaar: Joi.string().pattern(/^[0-9]{12}$/).optional(),
  companyname: Joi.string().max(100).optional(),
  licenseno: Joi.string().max(100).optional(),
  gstno: Joi.string().max(100).optional(),
  contactperson: Joi.string().max(100).optional(),
  // Car fields
  brand: Joi.string().required(),
  model: Joi.string().required(),
  variant: Joi.string().required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  purchasedate: Joi.date().required(),
  numplate: Joi.string().required(),
  price: Joi.number().positive().required(),
  exteriorColour: Joi.string().required(),
  interiorColour: Joi.string().required(),
  kmdriven: Joi.number().integer().min(0).required(),
  fueltype: Joi.string().valid('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG').required(),
  transmission: Joi.string().valid('Manual', 'Automatic', 'CVT', 'DCT').required(),
  ownership: Joi.string().valid('1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner').required(),
  location: Joi.string().required(),
  description: Joi.string().max(1000).optional(),
});

module.exports = { carSchema };