const Joi = require('joi');

const createBannerSchema = Joi.object({
  link_url: Joi.string().uri().allow('', null).optional(),
  title: Joi.string().allow('', null).optional(),
  order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

const updateBannerSchema = Joi.object({
  link_url: Joi.string().uri().allow('', null).optional(),
  title: Joi.string().allow('', null).optional(),
  order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

const reorderBannerSchema = Joi.object({
  orders: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      order: Joi.number().integer().min(0).required(),
    })
  ).min(1).required(),
});

module.exports = {
  createBannerSchema,
  updateBannerSchema,
  reorderBannerSchema,
};
