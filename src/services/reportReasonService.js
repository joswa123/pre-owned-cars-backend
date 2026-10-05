'use strict';

const { ReportReason, CarReport } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const redisClient = require('../config/redis');

/**
 * Invalidate cached report reasons
 */
const invalidateReportReasonsCache = async () => {
  try {
    if (!redisClient.isOpen) return;
    const patterns = [
      '__express__/api/report-reasons*',
      '__express__/api/v1/report-reasons*',
    ];
    for (const pattern of patterns) {
      for await (const chunk of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        const batch = Array.isArray(chunk) ? chunk : (chunk ? [chunk] : []);
        if (batch.length > 0) {
          await redisClient.del(batch);
        }
      }
    }
  } catch (err) {
    logger.warn(`Failed to clear report reasons cache: ${err.message}`);
  }
};

/**
 * Format a reason entity for admin responses
 */
const formatAdminReason = (item) => {
  const plain = typeof item.toJSON === 'function' ? item.toJSON() : { ...item };
  return {
    id: plain.id,
    label: plain.label,
    value: plain.value,
    isActive: Boolean(plain.is_active),
    is_active: Boolean(plain.is_active),
    sortOrder: plain.sort_order,
    sort_order: plain.sort_order,
    description: plain.description || null,
    createdAt: plain.created_at,
    updatedAt: plain.updated_at,
  };
};

/**
 * 1. Public: Get active report reasons for dropdown
 */
exports.getPublicReasons = async () => {
  const reasons = await ReportReason.findAll({
    where: { is_active: true },
    attributes: ['id', 'label', 'value'],
    order: [
      ['sort_order', 'ASC'],
      ['label', 'ASC'],
    ],
  });

  return reasons.map((r) => ({
    id: r.id,
    label: r.label,
    value: r.value,
  }));
};

/**
 * 2. Admin: Get all reasons (active + inactive) with search, filter, and pagination
 */
exports.getAllReasons = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const whereClause = {};

  // Active status filter
  if (query.isActive !== undefined || query.is_active !== undefined) {
    const rawVal = query.isActive !== undefined ? query.isActive : query.is_active;
    whereClause.is_active = rawVal === 'true' || rawVal === true;
  }

  // Search by label or value
  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const term = `%${query.search.trim()}%`;
    whereClause[Op.or] = [
      { label: { [Op.like]: term } },
      { value: { [Op.like]: term } },
    ];
  }

  const { count, rows } = await ReportReason.findAndCountAll({
    where: whereClause,
    order: [
      ['sort_order', 'ASC'],
      ['label', 'ASC'],
    ],
    limit,
    offset,
  });

  return {
    reasons: rows.map(formatAdminReason),
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * 3. Admin: Get single report reason by ID
 */
exports.getReasonById = async (id) => {
  const reason = await ReportReason.findByPk(id);
  if (!reason) {
    throw new AppError('Report reason not found.', 404);
  }
  return formatAdminReason(reason);
};

/**
 * 4. Admin: Create report reason
 */
exports.createReason = async (data, adminUser = null) => {
  const cleanValue = data.value.trim().toLowerCase();

  // Check unique value
  const existing = await ReportReason.findOne({ where: { value: cleanValue } });
  if (existing) {
    const err = new AppError('Value already exists', 400);
    err.errors = { value: 'Value already exists' };
    throw err;
  }

  const isActive = data.isActive !== undefined
    ? Boolean(data.isActive)
    : (data.is_active !== undefined ? Boolean(data.is_active) : true);

  const sortOrder = data.sortOrder !== undefined
    ? parseInt(data.sortOrder, 10)
    : (data.sort_order !== undefined ? parseInt(data.sort_order, 10) : 0);

  const reason = await ReportReason.create({
    label: data.label.trim(),
    value: cleanValue,
    is_active: isActive,
    sort_order: sortOrder,
    description: data.description ? data.description.trim() : null,
  });

  await invalidateReportReasonsCache();

  logger.info(`[Admin Audit] Created report reason ${reason.id} ("${reason.label}", value: "${reason.value}") by admin ${adminUser?.id || 'system'}`);

  return formatAdminReason(reason);
};

/**
 * 5. Admin: Update report reason
 */
exports.updateReason = async (id, data, adminUser = null) => {
  const reason = await ReportReason.findByPk(id);
  if (!reason) {
    throw new AppError('Report reason not found.', 404);
  }

  const updateFields = {};

  if (data.label !== undefined) {
    updateFields.label = data.label.trim();
  }

  if (data.value !== undefined) {
    const cleanValue = data.value.trim().toLowerCase();
    if (cleanValue !== reason.value) {
      const existing = await ReportReason.findOne({ where: { value: cleanValue } });
      if (existing && existing.id !== reason.id) {
        const err = new AppError('Value already exists', 400);
        err.errors = { value: 'Value already exists' };
        throw err;
      }
      updateFields.value = cleanValue;
    }
  }

  if (data.isActive !== undefined || data.is_active !== undefined) {
    const val = data.isActive !== undefined ? data.isActive : data.is_active;
    updateFields.is_active = Boolean(val);
  }

  if (data.sortOrder !== undefined || data.sort_order !== undefined) {
    const val = data.sortOrder !== undefined ? data.sortOrder : data.sort_order;
    updateFields.sort_order = parseInt(val, 10);
  }

  if (data.description !== undefined) {
    updateFields.description = data.description ? data.description.trim() : null;
  }

  await reason.update(updateFields);
  await invalidateReportReasonsCache();

  logger.info(`[Admin Audit] Updated report reason ${reason.id} by admin ${adminUser?.id || 'system'}`);

  return formatAdminReason(reason);
};

/**
 * 6. Admin: Delete report reason (protected against deletion if referenced)
 */
exports.deleteReason = async (id, adminUser = null) => {
  const reason = await ReportReason.findByPk(id);
  if (!reason) {
    throw new AppError('Report reason not found.', 404);
  }

  // Check if any existing car reports reference this reason value
  const reportCount = await CarReport.count({ where: { reason: reason.value } });
  if (reportCount > 0) {
    throw new AppError(
      `Cannot delete report reason because it is referenced by ${reportCount} existing car report(s). Consider deactivating it instead.`,
      400
    );
  }

  await reason.destroy();
  await invalidateReportReasonsCache();

  logger.info(`[Admin Audit] Deleted report reason ${id} ("${reason.label}") by admin ${adminUser?.id || 'system'}`);

  return { success: true, message: 'Report reason deleted successfully' };
};
