const { Requirement, Brand, Model, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
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
  const model = await Model.findByPk(data.model_id);
  if (!model) {
    throw new AppError('Model not found', 404);
  }
  if (model.brandId !== data.brand_id) {
    throw new AppError('Model does not belong to the selected brand', 400);
  }

  // 3. Compute expiry date
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + data.purchase_plan_days);

  const kmValue = data.km_driven !== undefined && data.km_driven !== null && data.km_driven !== ''
    ? data.km_driven
    : (data.km !== undefined && data.km !== null && data.km !== '' ? data.km : null);

  // 4. Create requirement
  const requirement = await Requirement.create({
    user_id: userId,
    brand_id: data.brand_id,
    model_id: data.model_id,
    year: data.year || null,
    price: data.price || null,
    km_driven: kmValue,
    body_type: data.body_type,
    transmission: data.transmission,
    board_type: data.board_type,
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
 * Get all requirements belonging to the authenticated user.
 * Returns all requirements (active, expired, bought, deleted) by default without automatic exclusion.
 * Optionally filters by status if provided in filters.
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
 * Get a single requirement by ID (ownership protected)
 */
exports.getRequirementById = async (requirementId, userId) => {
  const requirement = await Requirement.findOne({
    where: { id: requirementId },
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
    ],
  });

  if (!requirement) {
    throw new AppError('Requirement not found', 404);
  }

  if (requirement.user_id !== userId) {
    throw new AppError('Unauthorized to view this requirement', 403);
  }

  // Dynamic expiry: auto-expire if active and past expiry date
  if (requirement.status === 'active' && requirement.expiry_date && new Date(requirement.expiry_date) < new Date()) {
    await requirement.update({ status: 'expired' });
  }

  return requirement;
};

/**
 * Update a requirement (all fields except status)
 */
exports.updateRequirement = async (requirementId, userId, data) => {
  const transaction = await sequelize.transaction();

  try {
    // 1. Fetch existing requirement
    const requirement = await Requirement.findOne({
      where: { id: requirementId },
      transaction,
    });

    if (!requirement) {
      throw new AppError('Requirement not found', 404);
    }

    if (requirement.user_id !== userId) {
      throw new AppError('Unauthorized to update this requirement', 403);
    }

    // Determine target brandId
    const targetBrandId = data.brand_id || requirement.brand_id;

    // 2. Validate brand_id if provided
    if (data.brand_id) {
      const brand = await Brand.findByPk(data.brand_id, { transaction });
      if (!brand) {
        throw new AppError('Brand not found', 404);
      }
    }

    // 3. Validate model_id if provided (and belongs to brand)
    if (data.model_id) {
      const model = await Model.findByPk(data.model_id, { transaction });
      if (!model) {
        throw new AppError('Model not found', 404);
      }
      const modelBrandId = model.brandId || model.brand_id;
      if (modelBrandId !== targetBrandId) {
        throw new AppError('Model does not belong to the selected brand', 400);
      }
    } else if (data.brand_id && data.brand_id !== requirement.brand_id) {
      // If brand_id changed without providing a new model_id, check if existing model belongs to new brand
      const currentModel = await Model.findByPk(requirement.model_id, { transaction });
      const currentModelBrandId = currentModel ? (currentModel.brandId || currentModel.brand_id) : null;
      if (currentModelBrandId !== data.brand_id) {
        throw new AppError('Model does not belong to the selected brand', 400);
      }
    }

    // 4. Prepare update fields (only allowed ones)
    const allowedFields = [
      'brand_id',
      'model_id',
      'year',
      'price',
      'km_driven',
      'body_type',
      'transmission',
      'board_type',
      'color',
      'description',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Support 'km' alias for 'km_driven'
    if (data.km !== undefined && data.km_driven === undefined) {
      updateData.km_driven = data.km !== '' && data.km !== null ? data.km : null;
    }

    // 5. Handle purchase_plan_days -> recompute expiry_date
    if (data.purchase_plan_days !== undefined) {
      const days = parseInt(data.purchase_plan_days);
      if (isNaN(days) || days < 1 || days > 365) {
        throw new AppError('purchase_plan_days must be between 1 and 365', 400);
      }
      const createdDate = new Date(requirement.created_at || requirement.createdAt);
      updateData.expiry_date = new Date(createdDate.getTime() + days * 24 * 60 * 60 * 1000);
      updateData.purchase_plan_days = days;
    }

    // 6. Update the requirement
    await requirement.update(updateData, { transaction });
    await transaction.commit();

    // 7. Reload and return (with associations)
    return await exports.getRequirementById(requirementId, userId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
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

/**
 * Match active cars to a requirement (exact match on provided fields)
 */
exports.matchCarsToRequirement = async (requirementId, userId, queryParams = {}) => {
  const requirement = await Requirement.findOne({
    where: { id: requirementId },
  });

  if (!requirement) {
    throw new AppError('Requirement not found', 404);
  }

  if (requirement.user_id !== userId) {
    throw new AppError('Unauthorized to search cars for this requirement', 403);
  }

  if (requirement.status === 'deleted') {
    throw new AppError('Cannot search cars for a deleted requirement', 400);
  }

  // Dynamic expiry: update if past expiry
  if (requirement.status === 'active' && requirement.expiry_date && new Date(requirement.expiry_date) < new Date()) {
    await requirement.update({ status: 'expired' });
  }

  if (requirement.status === 'expired') {
    throw new AppError('Cannot search cars for an expired requirement', 400);
  }

  // Build filter object for carService.getCars
  const carFilters = {};

  if (requirement.brand_id) {
    carFilters.brands = [requirement.brand_id];
  }

  if (requirement.model_id) {
    carFilters.models = [requirement.model_id];
  }

  if (requirement.year !== null && requirement.year !== undefined && requirement.year !== '') {
    carFilters.year = requirement.year;
  }

  if (requirement.price !== null && requirement.price !== undefined && requirement.price !== '') {
    carFilters.price = requirement.price;
  }

  if (requirement.km_driven !== null && requirement.km_driven !== undefined && requirement.km_driven !== '') {
    carFilters.km_driven = requirement.km_driven;
  }

  if (requirement.body_type) {
    carFilters.body_types = [requirement.body_type];
  }

  if (requirement.transmission) {
    carFilters.transmissions = [requirement.transmission];
  }

  if (requirement.board_type) {
    carFilters.board_types = [requirement.board_type];
  }

  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 20;
  const sortBy = queryParams.sortBy || 'created_at';
  const sortOrder = queryParams.sortOrder || 'DESC';

  const carService = require('./carService');
  return await carService.getCars(carFilters, page, limit, sortBy, sortOrder, userId);
};
