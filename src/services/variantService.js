const { Variant, Model } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');

exports.getAllVariants = async (modelId = null) => {
  const where = {};
  if (modelId) {
    const modelIdStr = String(modelId).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modelIdStr);
    let targetModelId = modelIdStr;
    if (isUuid) {
      targetModelId = modelIdStr;
    } else if (/^\d+$/.test(modelIdStr)) {
      const model = await Model.findOne({
        where: { external_id: parseInt(modelIdStr, 10) },
      });
      if (model) {
        targetModelId = model.id;
      } else {
        return [];
      }
    }
    where.model_id = targetModelId;
  }
  return await Variant.findAll({
    where,
    include: [{ model: Model, as: 'model', attributes: ['id', 'name', 'external_id'] }],
    order: [['name', 'ASC']],
  });
};

exports.getVariantById = async (id) => {
  const idStr = String(id).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
  const where = isUuid ? { id: idStr } : (/^\d+$/.test(idStr) ? { external_id: parseInt(idStr, 10) } : { id: idStr });

  const variant = await Variant.findOne({
    where,
    include: [{ model: Model, as: 'model', attributes: ['id', 'name', 'external_id'] }],
  });
  if (!variant) throw new AppError('Variant not found', 404);
  return variant;
};

exports.createVariant = async (data) => {
  const { name, model_id } = data;
  const model = await Model.findByPk(model_id);
  if (!model) throw new AppError('Model not found', 404);

  const existing = await Variant.findOne({ where: { name: name.trim(), model_id } });
  if (existing) throw new AppError('Variant already exists for this model', 400);

  const variant = await Variant.create({
    name: name.trim(),
    model_id,
  });
  return variant;
};

/**
 * Bulk create variants for a single model.
 * @param {string} modelId - Model UUID
 * @param {string[]} variantNames - Array of variant names (e.g., ['VX', 'ZX', 'G'])
 * @param {object} options - Optional transaction
 * @returns {object} { created: [], skipped: [] }
 */
exports.bulkCreateVariants = async (modelId, variantNames, options = {}) => {
  const model = await Model.findByPk(modelId);
  if (!model) throw new AppError('Model not found', 404);

  const created = [];
  const skipped = [];

  // Use transaction if provided
  const transaction = options.transaction || await sequelize.transaction();

  try {
    for (const name of variantNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      const [variant, createdFlag] = await Variant.findOrCreate({
        where: { model_id: modelId, name: trimmed },
        defaults: { model_id: modelId, name: trimmed },
        transaction,
      });
      
      if (createdFlag) {
        created.push(variant);
      } else {
        skipped.push(trimmed);
      }
    }

    if (!options.transaction) await transaction.commit();
    return { created, skipped };
  } catch (error) {
    if (!options.transaction) await transaction.rollback();
    throw error;
  }
};

exports.updateVariant = async (id, data) => {
  const variant = await Variant.findByPk(id);
  if (!variant) throw new AppError('Variant not found', 404);

  if (data.model_id) {
    const model = await Model.findByPk(data.model_id);
    if (!model) throw new AppError('Model not found', 404);
  }

  await variant.update(data);
  return variant;
};

exports.deleteVariant = async (id) => {
  const variant = await Variant.findByPk(id);
  if (!variant) throw new AppError('Variant not found', 404);
  await variant.destroy();
  return { message: 'Variant deleted' };
};
