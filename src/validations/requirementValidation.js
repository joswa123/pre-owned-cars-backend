const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.string().uuid(),
  Joi.number().integer().positive(),
  Joi.string().regex(/^\d+$/)
);

const createRequirementSchema = Joi.object({
  target_type: Joi.string().valid('car', 'commercial', 'bike').optional().default('car'),
  brand_id: idSchema.optional(),
  brandName: Joi.string().trim().max(100).optional(),
  brand: Joi.string().trim().max(100).optional(),

  // Car-specific fields
  model_id: idSchema.optional(),
  modelName: Joi.string().trim().max(100).optional(),
  model: Joi.string().trim().max(100).optional(),
  body_type: Joi.string().trim().max(50).optional().allow(null, ''),
  board_type: Joi.string().trim().max(50).optional().allow(null, ''),
  transmission: Joi.alternatives().try(
    Joi.string().allow('', null),
    Joi.array().items(Joi.string().allow('', null))
  ).optional(),
  color: Joi.string().trim().max(50).optional().allow(null, ''),

  // Commercial-specific fields
  vehicle_type_id: idSchema.optional(),
  vehicleTypeName: Joi.string().trim().max(100).optional(),
  vehicle_type: Joi.string().trim().max(100).optional(),

  // Common fields
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  min_price: Joi.number().min(0).optional().allow(null, ''),
  max_price: Joi.number().min(0).optional().allow(null, ''),
  price: Joi.alternatives().try(
    Joi.object({
      min: Joi.number().min(0).optional().allow(null, ''),
      max: Joi.number().min(0).optional().allow(null, ''),
    }),
    Joi.number().min(0)
  ).optional(),
  min_km: Joi.number().integer().min(0).optional().allow(null, ''),
  max_km: Joi.number().integer().min(0).optional().allow(null, ''),
  km_driven: Joi.alternatives().try(
    Joi.object({
      min: Joi.number().integer().min(0).optional().allow(null, ''),
      max: Joi.number().integer().min(0).optional().allow(null, ''),
    }),
    Joi.number().integer().min(0)
  ).optional(),
  km: Joi.alternatives().try(
    Joi.object({
      min: Joi.number().integer().min(0).optional().allow(null, ''),
      max: Joi.number().integer().min(0).optional().allow(null, ''),
    }),
    Joi.number().integer().min(0)
  ).optional(),
  purchase_plan_days: Joi.number().integer().min(1).max(365).optional(),
  purchase_plan: Joi.alternatives().try(
    Joi.number().integer().min(1).max(365),
    Joi.string().trim()
  ).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
})
  .custom((value, helpers) => {
    const targetType = (value.target_type || 'car').toLowerCase();

    // 1. Purchase plan validation
    const hasPurchasePlan = value.purchase_plan_days !== undefined || value.purchase_plan !== undefined;
    if (!hasPurchasePlan) {
      return helpers.message('purchase_plan or purchase_plan_days is required');
    }

    // 2. Target type conditional validations
    if (targetType === 'commercial') {
      const hasBrand = value.brand_id || value.brandName || value.brand;
      if (!hasBrand) {
        return helpers.message('brand_id or brandName is required for commercial requirements');
      }

      const hasVehicleType = value.vehicle_type_id || value.vehicleTypeName || value.vehicle_type;
      if (!hasVehicleType) {
        return helpers.message('vehicle_type_id or vehicleTypeName is required for commercial requirements');
      }
    } else if (targetType === 'bike') {
      const hasBrand = value.brand_id || value.brandName || value.brand;
      if (!hasBrand) {
        return helpers.message('brand_id or brandName is required for bike requirements');
      }
    } else {
      // Car target
      const hasBrand = value.brand_id || value.brandName || value.brand;
      if (!hasBrand) {
        return helpers.message('brand_id is required for car requirements');
      }

      const hasModel = value.model_id || value.modelName || value.model;
      if (!hasModel) {
        return helpers.message('model_id is required for car requirements');
      }

      if (!value.body_type) {
        return helpers.message('body_type is required for car requirements');
      }

      if (!value.board_type) {
        return helpers.message('board_type is required for car requirements');
      }
    }

    // 3. Price & KM range consistency checks
    if (
      value.min_price !== undefined && value.min_price !== null && value.min_price !== '' &&
      value.max_price !== undefined && value.max_price !== null && value.max_price !== ''
    ) {
      if (Number(value.min_price) > Number(value.max_price)) {
        return helpers.message('min_price cannot be greater than max_price');
      }
    }
    if (
      value.min_km !== undefined && value.min_km !== null && value.min_km !== '' &&
      value.max_km !== undefined && value.max_km !== null && value.max_km !== ''
    ) {
      if (Number(value.min_km) > Number(value.max_km)) {
        return helpers.message('min_km cannot be greater than max_km');
      }
    }

    return value;
  })
  .unknown(true);

const updateRequirementStatusSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'expired', 'inactive', 'bought', 'sold', 'deleted')
    .required(),
  bought_from: Joi.string().trim().when('status', {
    is: Joi.valid('bought', 'sold'),
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
}).unknown(true);

const updateRequirementSchema = Joi.object({
  target_type: Joi.string().valid('car', 'commercial', 'bike').optional(),
  brand_id: idSchema.optional(),
  brandName: Joi.string().trim().max(100).optional(),
  brand: Joi.string().trim().max(100).optional(),

  model_id: idSchema.optional(),
  modelName: Joi.string().trim().max(100).optional(),
  model: Joi.string().trim().max(100).optional(),

  vehicle_type_id: idSchema.optional(),
  vehicleTypeName: Joi.string().trim().max(100).optional(),
  vehicle_type: Joi.string().trim().max(100).optional(),

  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().allow(null, ''),
  min_price: Joi.number().min(0).optional().allow(null, ''),
  max_price: Joi.number().min(0).optional().allow(null, ''),
  price: Joi.alternatives().try(
    Joi.object({
      min: Joi.number().min(0).optional().allow(null, ''),
      max: Joi.number().min(0).optional().allow(null, ''),
    }),
    Joi.number().min(0)
  ).optional(),
  min_km: Joi.number().integer().min(0).optional().allow(null, ''),
  max_km: Joi.number().integer().min(0).optional().allow(null, ''),
  km_driven: Joi.alternatives().try(
    Joi.object({
      min: Joi.number().integer().min(0).optional().allow(null, ''),
      max: Joi.number().integer().min(0).optional().allow(null, ''),
    }),
    Joi.number().integer().min(0)
  ).optional(),
  km: Joi.alternatives().try(
    Joi.object({
      min: Joi.number().integer().min(0).optional().allow(null, ''),
      max: Joi.number().integer().min(0).optional().allow(null, ''),
    }),
    Joi.number().integer().min(0)
  ).optional(),
  body_type: Joi.string().trim().max(50).optional().allow(null, ''),
  transmission: Joi.alternatives().try(
    Joi.string().allow('', null),
    Joi.array().items(Joi.string().allow('', null))
  ).optional(),
  board_type: Joi.string().trim().max(50).optional().allow(null, ''),
  color: Joi.string().trim().max(50).optional().allow(null, ''),
  purchase_plan_days: Joi.number().integer().min(1).max(365).optional(),
  purchase_plan: Joi.alternatives().try(
    Joi.number().integer().min(1).max(365),
    Joi.string().trim()
  ).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
})
  .min(1)
  .custom((value, helpers) => {
    if (
      value.min_price !== undefined && value.min_price !== null && value.min_price !== '' &&
      value.max_price !== undefined && value.max_price !== null && value.max_price !== ''
    ) {
      if (Number(value.min_price) > Number(value.max_price)) {
        return helpers.message('min_price cannot be greater than max_price');
      }
    }
    if (
      value.min_km !== undefined && value.min_km !== null && value.min_km !== '' &&
      value.max_km !== undefined && value.max_km !== null && value.max_km !== ''
    ) {
      if (Number(value.min_km) > Number(value.max_km)) {
        return helpers.message('min_km cannot be greater than max_km');
      }
    }
    return value;
  })
  .unknown(true);

const queryRequirementSchema = Joi.object({
  status: Joi.string().valid('active', 'expired', 'inactive', 'bought', 'sold', 'deleted', 'all').optional(),
  target_type: Joi.string().valid('car', 'commercial', 'bike', 'all').optional(),
  brand_id: idSchema.optional(),
  vehicle_type_id: idSchema.optional(),
  model_id: idSchema.optional(),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
}).unknown(true);

module.exports = {
  createRequirementSchema,
  updateRequirementSchema,
  updateRequirementStatusSchema,
  queryRequirementSchema,
};
