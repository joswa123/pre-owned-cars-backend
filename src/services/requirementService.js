const { Requirement, Brand, Model, CarType, VehicleType, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { AppError } = require('../utils/errorHandler');
const { resolveBrandId, resolveModelId } = require('../utils/idResolver');

const ALLOWED_TRANSMISSIONS = ['Manual', 'Automatic', 'Clutchless Manual', 'CVT', 'DCT'];
const TRANSMISSION_CANONICAL_MAP = {
  'manual': 'Manual',
  'automatic': 'Automatic',
  'clutchless manual': 'Clutchless Manual',
  'clutchless-manual': 'Clutchless Manual',
  'cvt': 'CVT',
  'dct': 'DCT',
};

const isUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

/**
 * Parses raw transmission input into a normalized array of Title-Case transmissions.
 *
 * @param {string|string[]|null|undefined} raw
 * @returns {string[]} Normalized Title Case transmission list
 */
function parseTransmissionList(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(',');
  const result = [];

  for (const entry of items) {
    if (!entry) continue;
    const trimmed = String(entry).trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower === 'any') continue;

    const canonical = TRANSMISSION_CANONICAL_MAP[lower];
    if (canonical && ALLOWED_TRANSMISSIONS.includes(canonical)) {
      if (!result.includes(canonical)) {
        result.push(canonical);
      }
    } else {
      console.warn(`[RequirementService] Unknown transmission dropped: "${trimmed}"`);
    }
  }
  return result;
}

/**
 * Resolves purchase_plan / purchase_plan_days into an integer number of days.
 * Handles inputs like: 30, "30", "30 Days", "1 Month", "Immediate"
 *
 * @param {string|number|null|undefined} raw
 * @returns {number} Days between 1 and 365 (default: 30)
 */
function resolvePurchasePlanDays(raw) {
  if (raw === undefined || raw === null || raw === '') return 30;
  if (typeof raw === 'number' && !isNaN(raw)) {
    return Math.min(Math.max(parseInt(raw, 10), 1), 365);
  }
  const str = String(raw).trim().toLowerCase();
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (str.includes('month')) return Math.min(num * 30, 365);
    if (str.includes('week')) return Math.min(num * 7, 365);
    if (str.includes('year')) return 365;
    return Math.min(Math.max(num, 1), 365);
  }
  if (str.includes('immediate') || str.includes('urgent')) return 7;
  return 30;
}

const requirementIncludes = [
  { model: Brand, as: 'brand', attributes: ['id', 'name'] },
  { model: Model, as: 'carModel', attributes: ['id', 'name'] },
  { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
];

/**
 * Normalizes requirement JSON response with helper fields.
 */
function formatRequirement(reqInstance) {
  if (!reqInstance) return null;
  const json = typeof reqInstance.toJSON === 'function' ? reqInstance.toJSON() : { ...reqInstance };
  const targetType = json.target_type || (json.vehicle_type_id ? 'commercial' : 'car');

  return {
    ...json,
    target_type: targetType,
    brand_name: json.brand?.name || null,
    model_name: json.carModel?.name || null,
    vehicle_type_name: json.vehicleType?.name || null,
    vehicle_name: targetType === 'commercial'
      ? [json.brand?.name, json.vehicleType?.name, json.year].filter(Boolean).join(' ') || 'Commercial Requirement'
      : (targetType === 'bike'
          ? [json.brand?.name, json.carModel?.name, json.year].filter(Boolean).join(' ') || 'Bike Requirement'
          : [json.brand?.name, json.carModel?.name, json.year].filter(Boolean).join(' ') || 'Car Requirement'),
  };
}

exports.parseTransmissionList = parseTransmissionList;
exports.ALLOWED_TRANSMISSIONS = ALLOWED_TRANSMISSIONS;
exports.resolvePurchasePlanDays = resolvePurchasePlanDays;
exports.formatRequirement = formatRequirement;

/**
 * Create a new Buying Requirement (Polymorphic: Car or Commercial Vehicle)
 */
exports.createRequirement = async (userId, data) => {
  const targetType = (data.target_type || (data.vehicle_type_id || data.vehicleTypeName ? 'commercial' : 'car')).toLowerCase();
  const purchaseDays = resolvePurchasePlanDays(data.purchase_plan_days !== undefined ? data.purchase_plan_days : data.purchase_plan);

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + purchaseDays);

  const minPrice = (data.min_price !== undefined && data.min_price !== '')
    ? data.min_price
    : (data.price && typeof data.price === 'object' && data.price.min !== undefined && data.price.min !== '' ? data.price.min : null);
  const maxPrice = (data.max_price !== undefined && data.max_price !== '')
    ? data.max_price
    : (data.price && typeof data.price === 'object' && data.price.max !== undefined && data.price.max !== '' ? data.price.max : null);
  const minKm = (data.min_km !== undefined && data.min_km !== '')
    ? data.min_km
    : (data.km_driven && typeof data.km_driven === 'object' && data.km_driven.min !== undefined && data.km_driven.min !== ''
      ? data.km_driven.min
      : (data.km && typeof data.km === 'object' && data.km.min !== undefined && data.km.min !== '' ? data.km.min : null));
  const maxKm = (data.max_km !== undefined && data.max_km !== '')
    ? data.max_km
    : (data.km_driven && typeof data.km_driven === 'object' && data.km_driven.max !== undefined && data.km_driven.max !== ''
      ? data.km_driven.max
      : (data.km && typeof data.km === 'object' && data.km.max !== undefined && data.km.max !== '' ? data.km.max : null));

  if (targetType === 'commercial') {
    // ── 1. Commercial Vehicle Requirement ──────────────────────────────
    const brandInput = data.brand_id || data.brandName || data.brand;
    if (!brandInput) throw new AppError('brand_id or brandName is required for commercial requirements', 400);

    let brandId = null;
    if (isUuid(brandInput) || !isNaN(brandInput)) {
      brandId = await resolveBrandId(brandInput);
    }
    if (!brandId) {
      const br = await Brand.findOne({ where: { name: String(brandInput).trim() } });
      brandId = br ? br.id : null;
    }
    if (!brandId) throw new AppError('Brand not found', 404);

    const typeInput = data.vehicle_type_id || data.vehicleTypeName || data.vehicle_type;
    if (!typeInput) throw new AppError('vehicle_type_id or vehicleTypeName is required for commercial requirements', 400);

    let vehicleTypeId = null;
    if (isUuid(typeInput)) {
      const vt = await CarType.findByPk(typeInput);
      vehicleTypeId = vt ? vt.id : null;
    } else {
      const trimmedType = String(typeInput).trim();
      const vt = await CarType.findOne({
        where: {
          [Op.or]: [
            { slug: trimmedType.toLowerCase() },
            { name: trimmedType },
          ],
        },
      });
      vehicleTypeId = vt ? vt.id : null;
    }
    if (!vehicleTypeId) throw new AppError('Vehicle type not found', 404);

    const requirement = await Requirement.create({
      target_type: 'commercial',
      user_id: userId,
      brand_id: brandId,
      vehicle_type_id: vehicleTypeId,
      model_id: null,
      year: data.year || null,
      min_price: minPrice,
      max_price: maxPrice,
      min_km: minKm,
      max_km: maxKm,
      body_type: data.body_type || null,
      transmission: null,
      board_type: data.board_type || null,
      color: data.color || null,
      purchase_plan_days: purchaseDays,
      expiry_date: expiryDate,
      status: 'active',
      description: data.description || null,
    });

    const dashboardService = require('./dashboardService');
    await dashboardService.invalidateDashboardCache(userId);

    const saved = await Requirement.findByPk(requirement.id, {
      include: requirementIncludes,
    });
    return formatRequirement(saved);
  }

  // ── 1b. Bike Requirement ───────────────────────────────────────────
  if (targetType === 'bike') {
    const brandId = await resolveBrandId(data.brand_id || data.brandName || data.brand);
    if (!brandId) throw new AppError('Brand not found', 404);

    let modelId = null;
    const rawModelInput = data.model_id || data.modelName || data.model;
    if (rawModelInput) {
      modelId = await resolveModelId(rawModelInput, brandId, data.body_type || 'Motorcycle');
      if (!modelId) throw new AppError('Model not found', 404);
    }

    let vehicleTypeId = null;
    const rawVtInput = data.vehicle_type_id || data.vehicle_type;
    if (rawVtInput) {
      if (isUuid(rawVtInput)) {
        const vt = await CarType.findByPk(rawVtInput);
        vehicleTypeId = vt ? vt.id : null;
      } else {
        const vt = await CarType.findOne({
          where: { [Op.or]: [{ slug: String(rawVtInput).toLowerCase().trim() }, { name: String(rawVtInput).trim() }] },
        });
        vehicleTypeId = vt ? vt.id : null;
      }
    }

    const requirement = await Requirement.create({
      target_type: 'bike',
      user_id: userId,
      brand_id: brandId,
      model_id: modelId,
      vehicle_type_id: vehicleTypeId,
      year: data.year || null,
      min_price: minPrice,
      max_price: maxPrice,
      min_km: minKm,
      max_km: maxKm,
      body_type: data.body_type || null,
      color: data.color || null,
      purchase_plan_days: purchaseDays,
      expiry_date: expiryDate,
      status: 'active',
      description: data.description || null,
    });

    const dashboardService = require('./dashboardService');
    await dashboardService.invalidateDashboardCache(userId);

    const saved = await Requirement.findByPk(requirement.id, {
      include: requirementIncludes,
    });
    return formatRequirement(saved);
  }

  // ── 2. Car Requirement ─────────────────────────────────────────────
  const brandId = await resolveBrandId(data.brand_id || data.brandName || data.brand);
  if (!brandId) {
    throw new AppError('Brand not found', 404);
  }

  const modelId = await resolveModelId(data.model_id || data.modelName || data.model, brandId, data.body_type || 'SUV');
  if (!modelId) {
    throw new AppError('Model not found', 404);
  }
  const model = await Model.findByPk(modelId);
  const modelBrandId = model ? (model.brandId || model.brand_id) : null;
  if (model && modelBrandId && modelBrandId !== brandId) {
    throw new AppError('Model does not belong to the selected brand', 400);
  }

  let normalizedTransmission = null;
  if (data.transmission !== undefined && data.transmission !== null) {
    const parsed = parseTransmissionList(data.transmission);
    normalizedTransmission = parsed.length > 0 ? parsed.join(', ') : null;
  }

  const requirement = await Requirement.create({
    target_type: 'car',
    user_id: userId,
    brand_id: brandId,
    model_id: modelId,
    vehicle_type_id: null,
    year: data.year || null,
    min_price: minPrice,
    max_price: maxPrice,
    min_km: minKm,
    max_km: maxKm,
    body_type: data.body_type || 'SUV',
    transmission: normalizedTransmission,
    board_type: data.board_type || 'Own Board',
    color: data.color || null,
    purchase_plan_days: purchaseDays,
    expiry_date: expiryDate,
    status: 'active',
    description: data.description || null,
  });

  const dashboardService = require('./dashboardService');
  await dashboardService.invalidateDashboardCache(userId);

  const saved = await Requirement.findByPk(requirement.id, {
    include: requirementIncludes,
  });
  return formatRequirement(saved);
};

/**
 * Get all requirements belonging to the authenticated user.
 * Supports filters: status ('active', 'inactive', 'expired', 'bought', 'sold', 'deleted', 'all'), target_type ('car', 'commercial', 'all')
 */
exports.getMyRequirements = async (userId, filters = {}) => {
  // 1. Run dynamic expiry logic: auto-expire requirements whose time has passed
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

  // Status filtering with alias normalization
  if (filters.status && filters.status !== 'all') {
    const s = String(filters.status).toLowerCase();
    if (s === 'active') {
      where.status = 'active';
      where.expiry_date = { [Op.gt]: new Date() };
    } else if (s === 'inactive' || s === 'expired') {
      where[Op.or] = [
        { status: 'expired' },
        { status: 'active', expiry_date: { [Op.lte]: new Date() } },
      ];
    } else if (s === 'bought' || s === 'sold') {
      where.status = 'bought';
    } else if (s === 'deleted') {
      where.status = 'deleted';
    } else {
      where.status = s;
    }
  }

  // Target type filtering
  const rawTargetType = filters.target_type || filters.type || filters.targetType || null;
  if (rawTargetType && rawTargetType !== 'all') {
    const norm = String(rawTargetType).toLowerCase();
    if (norm === 'commercial') {
      where.target_type = 'commercial';
    } else if (norm === 'car') {
      where[Op.or] = [{ target_type: 'car' }, { target_type: null }];
    } else {
      where.target_type = norm;
    }
  }

  const [statusCounts, { count, rows }] = await Promise.all([
    Requirement.findAll({
      where: {
        user_id: userId,
        ...(where.target_type ? { target_type: where.target_type } : {}),
        ...(where[Op.or] ? { [Op.or]: where[Op.or] } : {}),
      },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
    Requirement.findAndCountAll({
      where,
      include: requirementIncludes,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    }),
  ]);

  const summary = {
    total: 0,
    active: 0,
    expired: 0,
    bought: 0,
    deleted: 0,
  };
  statusCounts.forEach((r) => {
    const s = (r.status || '').toLowerCase();
    const c = parseInt(r.count, 10) || 0;
    summary.total += c;
    if (summary[s] !== undefined) {
      summary[s] = c;
    }
  });

  return {
    summary,
    total: count,
    requirements: rows.map(formatRequirement),
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
    include: requirementIncludes,
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

  return formatRequirement(requirement);
};

/**
 * Update a requirement (all fields except status)
 */
exports.updateRequirement = async (requirementId, userId, data) => {
  const transaction = await sequelize.transaction();

  try {
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

    const targetType = (data.target_type || requirement.target_type || 'car').toLowerCase();
    const updateData = {};

    // 1. Resolve Brand
    let resolvedBrandId = requirement.brand_id;
    const brandInput = data.brand_id || data.brandName || data.brand;
    if (brandInput) {
      if (isUuid(brandInput) || !isNaN(brandInput)) {
        resolvedBrandId = await resolveBrandId(brandInput, transaction);
      }
      if (!resolvedBrandId) {
        const br = await Brand.findOne({ where: { name: String(brandInput).trim() }, transaction });
        resolvedBrandId = br ? br.id : null;
      }
      if (!resolvedBrandId) throw new AppError('Brand not found', 404);
      updateData.brand_id = resolvedBrandId;
    }

    // 2. Resolve Model or Vehicle Type
    if (targetType === 'commercial') {
      const typeInput = data.vehicle_type_id || data.vehicleTypeName || data.vehicle_type;
      if (typeInput) {
        let vehicleTypeId = null;
        if (isUuid(typeInput)) {
          const vt = await CarType.findByPk(typeInput, { transaction });
          vehicleTypeId = vt ? vt.id : null;
        } else {
          const trimmedType = String(typeInput).trim();
          const vt = await CarType.findOne({
            where: {
              [Op.or]: [
                { slug: trimmedType.toLowerCase() },
                { name: trimmedType },
              ],
            },
            transaction,
          });
          vehicleTypeId = vt ? vt.id : null;
        }
        if (!vehicleTypeId) throw new AppError('Vehicle type not found', 404);
        updateData.vehicle_type_id = vehicleTypeId;
      }
      updateData.target_type = 'commercial';
    } else if (targetType === 'bike') {
      const modelInput = data.model_id || data.modelName || data.model;
      if (modelInput) {
        const resolvedModelId = await resolveModelId(modelInput, resolvedBrandId, data.body_type || 'Motorcycle', transaction);
        if (!resolvedModelId) throw new AppError('Model not found', 404);
        updateData.model_id = resolvedModelId;
      }
      updateData.target_type = 'bike';
    } else {
      // Car target
      let resolvedModelId = requirement.model_id;
      const modelInput = data.model_id || data.modelName || data.model;
      if (modelInput) {
        resolvedModelId = await resolveModelId(modelInput, resolvedBrandId, data.body_type || requirement.body_type || 'SUV', transaction);
        if (!resolvedModelId) throw new AppError('Model not found', 404);
        const model = await Model.findByPk(resolvedModelId, { transaction });
        const modelBrandId = model ? (model.brandId || model.brand_id) : null;
        if (model && modelBrandId && modelBrandId !== resolvedBrandId) {
          throw new AppError('Model does not belong to the selected brand', 400);
        }
        updateData.model_id = resolvedModelId;
      }
      updateData.target_type = 'car';
    }

    // 3. Prepare common fields
    const allowedFields = [
      'year',
      'min_price',
      'max_price',
      'min_km',
      'max_km',
      'body_type',
      'transmission',
      'board_type',
      'color',
      'description',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'transmission') {
          const parsed = parseTransmissionList(data.transmission);
          updateData.transmission = parsed.length > 0 ? parsed.join(', ') : null;
        } else {
          updateData[field] = data[field] === '' ? null : data[field];
        }
      }
    }

    if (data.price && typeof data.price === 'object') {
      if (data.price.min !== undefined) updateData.min_price = data.price.min === '' ? null : data.price.min;
      if (data.price.max !== undefined) updateData.max_price = data.price.max === '' ? null : data.price.max;
    }
    const kmObj = (data.km_driven && typeof data.km_driven === 'object')
      ? data.km_driven
      : (data.km && typeof data.km === 'object' ? data.km : null);
    if (kmObj) {
      if (kmObj.min !== undefined) updateData.min_km = kmObj.min === '' ? null : kmObj.min;
      if (kmObj.max !== undefined) updateData.max_km = kmObj.max === '' ? null : kmObj.max;
    }

    // Range consistency validation
    const targetMinPrice = updateData.min_price !== undefined ? updateData.min_price : requirement.min_price;
    const targetMaxPrice = updateData.max_price !== undefined ? updateData.max_price : requirement.max_price;
    if (targetMinPrice !== null && targetMinPrice !== undefined && targetMaxPrice !== null && targetMaxPrice !== undefined) {
      if (Number(targetMinPrice) > Number(targetMaxPrice)) {
        throw new AppError('min_price cannot be greater than max_price', 400);
      }
    }

    const targetMinKm = updateData.min_km !== undefined ? updateData.min_km : requirement.min_km;
    const targetMaxKm = updateData.max_km !== undefined ? updateData.max_km : requirement.max_km;
    if (targetMinKm !== null && targetMinKm !== undefined && targetMaxKm !== null && targetMaxKm !== undefined) {
      if (Number(targetMinKm) > Number(targetMaxKm)) {
        throw new AppError('min_km cannot be greater than max_km', 400);
      }
    }

    // Purchase plan update
    if (data.purchase_plan !== undefined || data.purchase_plan_days !== undefined) {
      const days = resolvePurchasePlanDays(data.purchase_plan_days !== undefined ? data.purchase_plan_days : data.purchase_plan);
      const createdDate = new Date(requirement.created_at || requirement.createdAt);
      updateData.expiry_date = new Date(createdDate.getTime() + days * 24 * 60 * 60 * 1000);
      updateData.purchase_plan_days = days;
    }

    await requirement.update(updateData, { transaction });
    await transaction.commit();

    const dashboardService = require('./dashboardService');
    await dashboardService.invalidateDashboardCache(userId);

    return await exports.getRequirementById(requirementId, userId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Update the status of a requirement ('active', 'expired', 'inactive', 'bought', 'sold', 'deleted')
 */
exports.updateRequirementStatus = async (requirementId, userId, data) => {
  const requirement = await Requirement.findOne({
    where: { id: requirementId, user_id: userId },
  });

  if (!requirement) {
    throw new AppError('Requirement not found or unauthorized', 404);
  }

  let newStatus = String(data.status).toLowerCase();
  if (newStatus === 'sold') newStatus = 'bought';
  if (newStatus === 'inactive') newStatus = 'expired';

  const updateFields = { status: newStatus };

  if (newStatus === 'bought') {
    updateFields.bought_from = data.bought_from;
  } else {
    updateFields.bought_from = null;
  }

  await requirement.update(updateFields);

  const dashboardService = require('./dashboardService');
  await dashboardService.invalidateDashboardCache(userId);

  const saved = await Requirement.findByPk(requirement.id, {
    include: requirementIncludes,
  });
  return formatRequirement(saved);
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

  await requirement.update({
    status: 'deleted',
    bought_from: null,
  });

  const dashboardService = require('./dashboardService');
  await dashboardService.invalidateDashboardCache(userId);

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

  if (filters.status && filters.status !== 'all') {
    const s = String(filters.status).toLowerCase();
    if (s === 'active') {
      where.status = 'active';
      where.expiry_date = { [Op.gt]: new Date() };
    } else if (s === 'inactive' || s === 'expired') {
      where[Op.or] = [
        { status: 'expired' },
        { status: 'active', expiry_date: { [Op.lte]: new Date() } },
      ];
    } else if (s === 'bought' || s === 'sold') {
      where.status = 'bought';
    } else if (s === 'deleted') {
      where.status = 'deleted';
    } else {
      where.status = s;
    }
  }

  const rawTargetType = filters.target_type || filters.type || filters.targetType || null;
  if (rawTargetType && rawTargetType !== 'all') {
    const norm = String(rawTargetType).toLowerCase();
    if (norm === 'commercial') {
      where.target_type = 'commercial';
    } else if (norm === 'car') {
      where[Op.or] = [{ target_type: 'car' }, { target_type: null }];
    } else {
      where.target_type = norm;
    }
  }

  if (filters.user_id) where.user_id = filters.user_id;
  if (filters.brand_id) where.brand_id = filters.brand_id;
  if (filters.vehicle_type_id) where.vehicle_type_id = filters.vehicle_type_id;
  if (filters.model_id) where.model_id = filters.model_id;

  if (filters.start_date || filters.end_date) {
    where.created_at = {};
    if (filters.start_date) where.created_at[Op.gte] = new Date(filters.start_date);
    if (filters.end_date) where.created_at[Op.lte] = new Date(filters.end_date);
  }

  const { count, rows } = await Requirement.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] },
      ...requirementIncludes,
    ],
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    total: count,
    requirements: rows.map(formatRequirement),
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * Match active vehicles to a requirement (polymorphic: matches cars or commercial vehicles)
 */
exports.matchCarsToRequirement = async (requirementId, userId, queryParams = {}) => {
  const requirement = await Requirement.findOne({
    where: { id: requirementId },
    include: requirementIncludes,
  });

  if (!requirement) {
    throw new AppError('Requirement not found', 404);
  }

  if (requirement.user_id !== userId) {
    throw new AppError('Unauthorized to search vehicles for this requirement', 403);
  }

  if (requirement.status === 'deleted') {
    throw new AppError('Cannot search vehicles for a deleted requirement', 400);
  }

  // Dynamic expiry: update if past expiry
  if (requirement.status === 'active' && requirement.expiry_date && new Date(requirement.expiry_date) < new Date()) {
    await requirement.update({ status: 'expired' });
  }

  if (requirement.status === 'expired') {
    throw new AppError('Cannot search vehicles for an expired requirement', 400);
  }

  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 20;
  const sortBy = queryParams.sortBy || 'created_at';
  const sortOrder = queryParams.sortOrder || 'DESC';

  const targetType = requirement.target_type || (requirement.vehicle_type_id ? 'commercial' : 'car');

  // ── Commercial Vehicle Match ──────────────────────────────────────────
  if (targetType === 'commercial') {
    const { CommercialVehicle, CommercialVehicleImage, User: UserModel, State, District, City, Wishlist, DealerProfile } = require('../models');
    const { transformCommercialVehicleImages, getCommercialWishlistCountMap } = require('./commercialVehicleService');
    const baseUrl = process.env.BASE_URL || 'https://pre-owned-cars-backend.onrender.com';

    const where = {
      status: 'active',
    };

    if (requirement.brand_id) {
      where.brand_id = requirement.brand_id;
    }
    if (requirement.vehicle_type_id) {
      where.vehicle_type_id = requirement.vehicle_type_id;
    }
    if (requirement.year) {
      where.year = requirement.year;
    }

    if (requirement.min_price || requirement.max_price) {
      where.price = {};
      if (requirement.min_price) where.price[Op.gte] = parseFloat(requirement.min_price);
      if (requirement.max_price) where.price[Op.lte] = parseFloat(requirement.max_price);
    }

    if (requirement.min_km || requirement.max_km) {
      where.km_driven = {};
      if (requirement.min_km) where.km_driven[Op.gte] = parseInt(requirement.min_km, 10);
      if (requirement.max_km) where.km_driven[Op.lte] = parseInt(requirement.max_km, 10);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await CommercialVehicle.findAndCountAll({
      where,
      include: [
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
        { model: CommercialVehicleImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        {
          model: UserModel,
          as: 'seller',
          attributes: ['id', 'full_name', 'phone', 'role', 'city'],
          include: [
            { model: District, as: 'district', attributes: ['id', 'name'] },
            { model: DealerProfile, as: 'dealerProfile', attributes: ['company_name'] },
          ],
        },
        { model: State, as: 'state', attributes: ['id', 'name'] },
        { model: District, as: 'district', attributes: ['id', 'name'] },
        { model: City, as: 'city', attributes: ['id', 'name'] },
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    });

    const vehicleIds = rows.map((v) => v.id);

    let wishlistSet = new Set();
    const [userWishlists, wishlistCountMap] = await Promise.all([
      userId && vehicleIds.length > 0
        ? Wishlist.findAll({
            where: { user_id: userId, target_type: 'commercial', target_id: vehicleIds },
            attributes: ['target_id'],
            raw: true,
          })
        : Promise.resolve([]),
      getCommercialWishlistCountMap(vehicleIds),
    ]);

    if (userId) {
      wishlistSet = new Set(userWishlists.map((w) => w.target_id));
    }

    const transformedVehicles = rows.map((v) => {
      const transformed = transformCommercialVehicleImages(v, baseUrl, { id: userId });
      transformed.target_type = 'commercial';
      const isW = wishlistSet.has(v.id);
      return {
        ...transformed,
        isWishlist: isW,
        is_wishlist: isW,
        wishlist_count: wishlistCountMap[v.id] || 0,
        cityDetail: transformed.cityDetail || transformed.city || null,
        districtDetail: transformed.districtDetail || transformed.district || null,
        stateDetail: transformed.stateDetail || transformed.state || null,
        dealerProfile: transformed.dealerProfile || transformed.seller?.dealerProfile || null,
      };
    });

    return {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      target_type: 'commercial',
      requirement: formatRequirement(requirement),
      vehicles: transformedVehicles,
      cars: transformedVehicles, // backward compatibility
      listings: transformedVehicles, // backward compatibility
      data: transformedVehicles, // backward compatibility
    };
  }

  // ── Bike Match ─────────────────────────────────────────────────────────
  if (targetType === 'bike') {
    const bikeService = require('./bikeService');
    const bikeFilters = {};
    if (requirement.brand_id) bikeFilters.brand_id = requirement.brand_id;
    if (requirement.model_id) bikeFilters.model_id = requirement.model_id;
    if (requirement.vehicle_type_id) bikeFilters.vehicle_type_id = requirement.vehicle_type_id;
    if (requirement.year) bikeFilters.year = requirement.year;
    if (requirement.min_price) bikeFilters.min_price = requirement.min_price;
    if (requirement.max_price) bikeFilters.max_price = requirement.max_price;
    if (requirement.min_km) bikeFilters.min_km = requirement.min_km;
    if (requirement.max_km) bikeFilters.max_km = requirement.max_km;

    const result = await bikeService.getBikes(bikeFilters, page, limit, sortBy, sortOrder, userId, null);
    return {
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.totalPages,
      target_type: 'bike',
      requirement: formatRequirement(requirement),
      vehicles: result.bikes,
      bikes: result.bikes,
      cars: result.bikes,
      listings: result.bikes,
      data: result.bikes,
    };
  }

  // ── Car Match ──────────────────────────────────────────────────────────
  const carFilters = {};

  if (requirement.brand_id) carFilters.brands = [requirement.brand_id];
  if (requirement.model_id) carFilters.models = [requirement.model_id];
  if (requirement.year) carFilters.year = requirement.year;
  if (requirement.min_price) carFilters.min_price = requirement.min_price;
  if (requirement.max_price) carFilters.max_price = requirement.max_price;
  if (requirement.min_km) carFilters.min_km = requirement.min_km;
  if (requirement.max_km) carFilters.max_km = requirement.max_km;
  if (requirement.body_type) carFilters.body_types = [requirement.body_type];

  if (requirement.transmission) {
    const parsed = parseTransmissionList(requirement.transmission);
    if (parsed.length > 0) {
      carFilters.transmissions = parsed.join(',');
    }
  }

  if (requirement.board_type) carFilters.board_types = [requirement.board_type];

  const carService = require('./carService');
  const result = await carService.getCars(carFilters, page, limit, sortBy, sortOrder, userId);

  const matchedCars = (result.cars || []).map((car) => ({
    ...car,
    cityDetail: car.cityDetail || car.city || null,
    districtDetail: car.districtDetail || car.district || null,
    stateDetail: car.stateDetail || car.state || null,
    dealerProfile: car.dealerProfile || car.seller?.dealerProfile || null,
  }));

  return {
    ...result,
    target_type: 'car',
    requirement: formatRequirement(requirement),
    vehicles: matchedCars,
    cars: matchedCars,
    listings: matchedCars,
    data: matchedCars,
  };
};

/**
 * Checks if a newly posted Bike matches any active Buyer Requirements and creates notifications.
 */
exports.checkBikeRequirementMatches = async (bike) => {
  if (!bike) return [];
  const activeReqs = await Requirement.findAll({
    where: {
      target_type: 'bike',
      status: 'active',
      brand_id: bike.brand_id,
      user_id: { [Op.ne]: bike.user_id },
      expiry_date: { [Op.gte]: new Date() },
    },
  });

  const matchedUsers = [];
  const { Notification } = require('../models');
  for (const req of activeReqs) {
    if (req.model_id && req.model_id !== bike.model_id) continue;
    if (req.min_price && Number(bike.price) < Number(req.min_price)) continue;
    if (req.max_price && Number(bike.price) > Number(req.max_price)) continue;
    if (req.year && bike.year < req.year) continue;
    if (req.max_km && bike.km_driven > req.max_km) continue;

    await Notification.create({
      user_id: req.user_id,
      requirement_id: req.id,
      target_type: 'bike',
      target_id: bike.id,
      car_id: null,
      type: 'requirement_match',
      message: `A new bike matching your requirement (${bike.title || 'Bike'}) was listed at ₹${bike.price}.`,
    });
    matchedUsers.push(req.user_id);
  }
  return matchedUsers;
};
