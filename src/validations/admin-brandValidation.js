const Joi = require('joi');

const addbrandSchema = Joi.object({
    user_id: Joi.string().uuid().required(),
    brand_name: Joi.string().min(3).max(100).required(),
    brand_logo_url: Joi.string().uri().required(),
    status: Joi.string().valid('Active', 'Inactive').default('Active'),
});

module.exports = { addbrandSchema };    