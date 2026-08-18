const { Model, Brand } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize= require('../config/database')
// services/modelService.js
exports.getAllModels = async (brandId = null) => {
  const where = {};
  if (brandId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId);
    let targetBrandId = brandId;
    if (!isUuid) {
      const searchName = brandId.replace(/-/g, ' ').trim().toLowerCase();
      const brand = await Brand.findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), searchName),
      });
      if (brand) {
        targetBrandId = brand.id;
      } else {
        return [];
      }
    }
    where.brandId = targetBrandId;
  }
  const models = await Model.findAll({
    where,
    attributes: [
      'id',
      'brandId',
      'name',
      'body_type',
      'image_url',
      'start_year',
      'end_year',
      'is_active',
      'created_at',
      'updated_at',
      [
        sequelize.literal(`(
          SELECT COUNT(*)
          FROM cars AS car
          WHERE car.model_id = Model.id
          AND car.status = 'active'
        )`),
        'car_count',
      ],
    ],
    include: [{ model: Brand, as: 'brand', attributes: ['id', 'name', 'logo'] }],
    order: [['name', 'ASC']],
  });

  return models.map((m) => {
    const json = m.toJSON();
    return {
      ...json,
      car_count: parseInt(json.car_count || 0, 10),
    };
  });
};

exports.getModelById = async (id) => {
  const model = await Model.findByPk(id, {
    attributes: [
      'id',
      'brandId',
      'name',
      'body_type',
      'image_url',
      'start_year',
      'end_year',
      'is_active',
      'created_at',
      'updated_at',
      [
        sequelize.literal(`(
          SELECT COUNT(*)
          FROM cars AS car
          WHERE car.model_id = Model.id
          AND car.status = 'active'
        )`),
        'car_count',
      ],
    ],
    include: [{ 
      model: Brand, 
      as: 'brand',
      attributes: ['id', 'name', 'logo'] 
    }],
  });
  if (!model) throw new AppError('Model not found', 404);
  const json = model.toJSON();
  return {
    ...json,
    car_count: parseInt(json.car_count || 0, 10),
  };
};

exports.createModel = async (data, userId) => {
  const { name, brandId } = data;
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new AppError('Brand not found', 404);

  const existing = await Model.findOne({ where: { name: name.trim(), brandId } });
  if (existing) throw new AppError('Model already exists for this brand', 400);

  const model = await Model.create({
    name: name.trim(),
    brandId,
  });
  return model;
};

exports.updateModel = async (id, data) => {
  const model = await Model.findByPk(id);
  if (!model) throw new AppError('Model not found', 404);

  if (data.brandId) {
    const brand = await Brand.findByPk(data.brandId);
    if (!brand) throw new AppError('Brand not found', 404);
  }

  await model.update(data);
  return model;
};

exports.deleteModel = async (id) => {
  const model = await Model.findByPk(id);
  if (!model) throw new AppError('Model not found', 404);
  await model.destroy();
  return { message: 'Model deleted' };
};