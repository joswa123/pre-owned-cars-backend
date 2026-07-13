const Joi = require('joi');

const brandSchema = Joi.object({
  name: Joi.string().max(100).required(),
  // logo is handled by multer, not in body
}).unknown(true);

const brandUpdateSchema = Joi.object({
  name: Joi.string().max(100),
});

module.exports = { brandSchema, brandUpdateSchema };