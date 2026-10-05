// controllers/carReportController.js
const { catchAsync } = require('../utils/errorHandler');
const carReportService = require('../services/carReportService');

/**
 * Submit report for a car listing (Public / Optional Auth for registered users)
 */
exports.createReport = catchAsync(async (req, res) => {
  const reporterUser = req.user || null;
  const report = await carReportService.createReport(reporterUser, req.body);

  res.status(201).json({
    status: 'success',
    success: true,
    message: 'Report submitted successfully. Our team will review this listing.',
    data: { report },
  });
});

/**
 * Get all car reports with filtering and pagination (Admin only)
 */
exports.getReports = catchAsync(async (req, res) => {
  const result = await carReportService.getReports(req.query);

  res.status(200).json({
    status: 'success',
    success: true,
    data: result,
  });
});

/**
 * Get single car report by ID (Admin only)
 */
exports.getReportById = catchAsync(async (req, res) => {
  const report = await carReportService.getReportById(req.params.id);

  res.status(200).json({
    status: 'success',
    success: true,
    data: { report },
  });
});

/**
 * Update report status and/or admin notes (Admin only)
 */
exports.updateReportStatus = catchAsync(async (req, res) => {
  const report = await carReportService.updateReportStatus(req.params.id, req.body);

  res.status(200).json({
    status: 'success',
    success: true,
    message: 'Report updated successfully.',
    data: { report },
  });
});
