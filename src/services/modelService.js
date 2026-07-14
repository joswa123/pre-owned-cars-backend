const { Model, Brand } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.getAllModels = async () => {
  return await Model.findAll({
    include: [{ 
      model: Brand, 
      // ❌ remove as: 'brand' – use default alias 'Brand'
      attributes: ['id', 'name', 'logo'] 
    }],
    order: [['name', 'ASC']],
  });
};

exports.getModelById = async (id) => {
  const model = await Model.findByPk(id, {
    include: [{ 
      model: Brand, 
      attributes: ['id', 'name', 'logo'] 
    }],
  });
  if (!model) throw new AppError('Model not found', 404);
  return model;
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