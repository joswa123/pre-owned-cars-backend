const Joi = require('joi');

const addcitySchema = Joi.object({
    user_id: Joi.string().uuid().required(),
    state_id: Joi.string().uuid().required(),
    city_name: Joi.string().min(3).max(100).required(),
    pin_code: Joi.string().min(3).max(10).required(),
    status: Joi.string().valid('Active', 'Inactive').default('Active'),
});

module.exports = { addcitySchema };