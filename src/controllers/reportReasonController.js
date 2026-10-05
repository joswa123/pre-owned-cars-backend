'use strict';

const reportReasonService = require('../services/reportReasonService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Public: Get active report reasons for dropdown
 */
exports.getPublicReasons = catchAsync(async (req, res) => {
  const reasons = await reportReasonService.getPublicReasons();

  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    success: true,
    message: 'Report reasons fetched successfully',
    data: reasons,
  });
});

/**
 * Admin: Get all reasons with search, filter, and pagination
 */
exports.getAllReasons = catchAsync(async (req, res) => {
  const result = await reportReasonService.getAllReasons(req.query);

  res.status(200).json({
    success: true,
    message: 'Report reasons retrieved successfully',
    data: result,
  });
});

/**
 * Admin: Get single report reason by ID
 */
exports.getReasonById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const reason = await reportReasonService.getReasonById(id);

  res.status(200).json({
    success: true,
    message: 'Report reason retrieved successfully',
    data: { reason },
  });
});

/**
 * Admin: Create report reason
 */
exports.createReason = catchAsync(async (req, res) => {
  const reason = await reportReasonService.createReason(req.body, req.user);

  res.status(201).json({
    success: true,
    message: 'Report reason created successfully',
    data: { reason },
  });
});

/**
 * Admin: Update report reason
 */
exports.updateReason = catchAsync(async (req, res) => {
  const { id } = req.params;
  const reason = await reportReasonService.updateReason(id, req.body, req.user);

  res.status(200).json({
    success: true,
    message: 'Report reason updated successfully',
    data: { reason },
  });
});

/**
 * Admin: Delete report reason
 */
exports.deleteReason = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await reportReasonService.deleteReason(id, req.user);

  res.status(200).json({
    success: true,
    message: result.message || 'Report reason deleted successfully',
  });
});
