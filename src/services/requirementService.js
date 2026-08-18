const { Requirement, Brand, Model, User } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');

/**
 * Create a new Buying Requirement
 */
exports.createRequirement = async (userId, data) => {
  // 1. Validate Brand exists
  const brand = await Brand.findByPk(data.brand_id);
  if (!brand) {
    throw new AppError('Brand not found', 404);
  }

  // 2. Validate Model exists and belongs to the selected Brand
  if (data.model_id) {
    const model = await Model.findByPk(data.model_id);
    if (!model) {
      throw new AppError('Model not found', 404);
    }
    if (model.brandId !== data.brand_id) {
      throw new AppError('Model does not belong to the selected brand', 400);
    }
  }

  // 3. Compute expiry date
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + data.purchase_plan_days);

  // 4. Create requirement
  const requirement = await Requirement.create({
    user_id: userId,
    brand_id: data.brand_id,
    model_id: data.model_id || null,
    min_year: data.min_year || null,
    max_year: data.max_year || null,
    min_price: data.min_price || null,
    max_price: data.max_price || null,
    min_km: data.min_km || null,
    max_km: data.max_km || null,
    body_type: data.body_type || null,
    transmission: data.transmission || null,
    board_type: data.board_type || null,
    color: data.color || null,
    purchase_plan_days: data.purchase_plan_days,
    expiry_date: expiryDate,
    status: 'active',
    description: data.description || null,
  });

  return await Requirement.findByPk(requirement.id, {
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });
};

/**
 * Get all requirements belonging to the authenticated user
 */
exports.getMyRequirements = async (userId, filters = {}) => {
  // 1. Run dynamic expiry logic: auto-expire requirements whose time has passed
  // Only evaluate active ones. Bought and deleted requirements are untouched.
  await Requirement.update(
    { status: 'expired' },
    {
      where: {
        user_id: userId,
        status: 'active',
        expiry_date: { [Op.lt]: new Date() },
      },
    }
  );

  const limit = parseInt(filters.limit) || 20;
  const page = parseInt(filters.page) || 1;
  const offset = (page - 1) * limit;

  const where = { user_id: userId };

  if (filters.status) {
    where.status = filters.status;
  } else {
    // Exclude deleted requirements by default
    where.status = { [Op.ne]: 'deleted' };
  }

  const { count, rows } = await Requirement.findAndCountAll({
    where,
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    total: count,
    requirements: rows,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * Update the status of a requirement
 */
exports.updateRequirementStatus = async (requirementId, userId, data) => {
  const requirement = await Requirement.findOne({
    where: { id: requirementId, user_id: userId },
  });

  if (!requirement) {
    throw new AppError('Requirement not found or unauthorized', 404);
  }

  const updateFields = { status: data.status };

  if (data.status === 'bought') {
    updateFields.bought_from = data.bought_from;
  } else {
    // Automatically clear bought_from when transitioning back or soft deleting
    updateFields.bought_from = null;
  }

  await requirement.update(updateFields);

  return await Requirement.findByPk(requirement.id, {
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });
};

/**
 * Soft delete a requirement
 */
exports.deleteRequirement = async (requirementId, userId) => {
  const requirement = await Requirement.findOne({
    where: { id: requirementId, user_id: userId },
  });

  if (!requirement) {
    throw new AppError('Requirement not found or unauthorized', 404);
  }

  // Soft delete requirement by setting status to 'deleted' and clearing bought_from
  await requirement.update({
    status: 'deleted',
    bought_from: null,
  });

  return { success: true };
};

/**
 * Admin view: Fetch all requirements with status, user, and date range filters
 */
exports.getAllRequirementsForAdmin = async (filters = {}) => {
  const limit = parseInt(filters.limit) || 20;
  const page = parseInt(filters.page) || 1;
  const offset = (page - 1) * limit;

  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.user_id) {
    where.user_id = filters.user_id;
  }

  if (filters.start_date || filters.end_date) {
    where.created_at = {};
    if (filters.start_date) {
      where.created_at[Op.gte] = new Date(filters.start_date);
    }
    if (filters.end_date) {
      where.created_at[Op.lte] = new Date(filters.end_date);
    }
  }

  const { count, rows } = await Requirement.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] },
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    total: count,
    requirements: rows,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};
