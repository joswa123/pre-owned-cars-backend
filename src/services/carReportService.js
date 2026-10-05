// services/carReportService.js
const { CarReport, Car, User, Brand, Model, CarImage } = require('../models');
const { AppError } = require('../utils/errorHandler');

/**
 * Submit a report for a car listing (authenticated user or guest)
 */
exports.createReport = async (reporterUser, data) => {
  const car = await Car.findByPk(data.car_id);
  if (!car) {
    throw new AppError('Car listing not found.', 404);
  }

  // Resolve dealer (the owner/seller of the car)
  const dealerId = car.user_id;

  // Resolve reporter identity
  let reporterId = null;
  let reporterName = '';
  let reporterPhone = '';

  if (reporterUser) {
    reporterId = reporterUser.id;
    reporterName = (data.reporter_name || reporterUser.full_name || '').trim();
    reporterPhone = (data.reporter_phone || reporterUser.phone || '').trim();
  } else {
    reporterName = (data.reporter_name || '').trim();
    reporterPhone = (data.reporter_phone || '').trim();
  }

  if (!reporterName) {
    throw new AppError('Reporter name is required.', 400);
  }

  if (!reporterPhone) {
    throw new AppError('Reporter phone number is required.', 400);
  }

  const report = await CarReport.create({
    car_id: car.id,
    dealer_id: dealerId,
    reporter_id: reporterId,
    reporter_name: reporterName,
    reporter_phone: reporterPhone,
    reason: data.reason,
    description: data.description ? data.description.trim() : null,
    status: 'pending',
  });

  return CarReport.findByPk(report.id, {
    include: [
      {
        model: Car,
        as: 'car',
        attributes: ['id', 'year', 'price', 'status'],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
        ],
      },
      {
        model: User,
        as: 'dealer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role'],
      },
    ],
  });
};

/**
 * Get paginated list of car reports (Admin only)
 */
exports.getReports = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.car_id) where.car_id = query.car_id;
  if (query.dealer_id) where.dealer_id = query.dealer_id;
  if (query.reason) where.reason = query.reason;

  const sortOrder = (query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const sortBy = ['created_at', 'updated_at', 'status'].includes(query.sortBy) ? query.sortBy : 'created_at';

  const { count, rows } = await CarReport.findAndCountAll({
    where,
    include: [
      {
        model: Car,
        as: 'car',
        attributes: ['id', 'year', 'price', 'status', 'brand_id', 'model_id', 'body_type'],
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        ],
      },
      {
        model: User,
        as: 'dealer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city'],
      },
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'full_name', 'phone', 'email'],
      },
    ],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  return {
    reports: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit) || 1,
    },
  };
};

/**
 * Get single car report by ID (Admin only)
 */
exports.getReportById = async (reportId) => {
  const report = await CarReport.findByPk(reportId, {
    include: [
      {
        model: Car,
        as: 'car',
        include: [
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
        ],
      },
      {
        model: User,
        as: 'dealer',
        attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city'],
      },
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'full_name', 'phone', 'email'],
      },
    ],
  });

  if (!report) {
    throw new AppError('Car report not found.', 404);
  }

  return report;
};

/**
 * Update report status / admin notes (Admin only)
 */
exports.updateReportStatus = async (reportId, updateData) => {
  const report = await CarReport.findByPk(reportId);
  if (!report) {
    throw new AppError('Car report not found.', 404);
  }

  const updates = {};
  if (updateData.status) {
    updates.status = updateData.status;
    if (updateData.status === 'resolved' && !report.resolved_at) {
      updates.resolved_at = new Date();
    }
  }

  if (updateData.admin_notes !== undefined) {
    updates.admin_notes = updateData.admin_notes ? updateData.admin_notes.trim() : null;
  }

  await report.update(updates);

  return exports.getReportById(reportId);
};
