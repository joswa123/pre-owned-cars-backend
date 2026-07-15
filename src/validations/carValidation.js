const Joi = require('joi');

const carSchema = Joi.object({  
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
  // ✅ Allow images field (handled by multer)
  images: Joi.any().optional(),
});

module.exports = { carSchema };