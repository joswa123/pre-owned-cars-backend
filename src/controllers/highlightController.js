'use strict';

const highlightService = require('../services/highlightService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Public: Get active highlights
 */
exports.getActiveHighlights = catchAsync(async (req, res) => {
  const highlights = await highlightService.getActiveHighlights();
  res.status(200).json({
    status: 'success',
    data: highlights,
  });
});

/**
 * Admin: Get all highlights (including inactive & cars_count)
 */
exports.getAllHighlights = catchAsync(async (req, res) => {
  const highlights = await highlightService.getAllHighlights();
  res.status(200).json({
    status: 'success',
    data: highlights,
  });
});

/**
 * Admin: Get single highlight by ID
 */
exports.getHighlightById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const highlight = await highlightService.getHighlightById(id);
  res.status(200).json({
    status: 'success',
    data: { highlight },
  });
});

/**
 * Admin: Create a new highlight
 */
exports.createHighlight = catchAsync(async (req, res) => {
  const highlight = await highlightService.createHighlight(req.body, req.user);
  res.status(201).json({
    status: 'success',
    message: 'Highlight created successfully.',
    data: { highlight },
  });
});

/**
 * Admin: Update an existing highlight (PUT)
 */
exports.updateHighlight = catchAsync(async (req, res) => {
  const { id } = req.params;
  const highlight = await highlightService.updateHighlight(id, req.body, req.user);
  res.status(200).json({
    status: 'success',
    message: 'Highlight updated successfully.',
    data: { highlight },
  });
});

/**
 * Admin: Patch highlight status (PATCH)
 */
exports.patchHighlight = catchAsync(async (req, res) => {
  const { id } = req.params;
  const highlight = await highlightService.patchHighlight(id, req.body, req.user);
  res.status(200).json({
    status: 'success',
    message: 'Highlight status updated successfully.',
    data: { highlight },
  });
});

/**
 * Admin: Delete a highlight (supports ?force=true)
 */
exports.deleteHighlight = catchAsync(async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true' || req.query.force === true;
  const result = await highlightService.deleteHighlight(id, force, req.user);
  res.status(200).json({
    status: 'success',
    message: result.message || 'Highlight deleted successfully.',
    data: null,
  });
});
