const Joi = require('joi');

const addstateSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  state_name: Joi.string().min(3).max(100).required(),
  state_code: Joi.string().min(2).max(10).required(),
  status: Joi.string().valid('Active', 'Inactive').default('Active'),
});

module.exports = {
  addstateSchema,
};