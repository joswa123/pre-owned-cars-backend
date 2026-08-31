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
 * Admin: Get all highlights (including inactive)
 */
exports.getAllHighlights = catchAsync(async (req, res) => {
  const highlights = await highlightService.getAllHighlights();
  res.status(200).json({
    status: 'success',
    data: highlights,
  });
});

/**
 * Admin: Create a new highlight
 */
exports.createHighlight = catchAsync(async (req, res) => {
  const highlight = await highlightService.createHighlight(req.body);
  res.status(201).json({
    status: 'success',
    message: 'Highlight created successfully.',
    data: { highlight },
  });
});

/**
 * Admin: Update an existing highlight
 */
exports.updateHighlight = catchAsync(async (req, res) => {
  const { id } = req.params;
  const highlight = await highlightService.updateHighlight(id, req.body);
  res.status(200).json({
    status: 'success',
    message: 'Highlight updated successfully.',
    data: { highlight },
  });
});

/**
 * Admin: Delete a highlight
 */
exports.deleteHighlight = catchAsync(async (req, res) => {
  const { id } = req.params;
  await highlightService.deleteHighlight(id);
  res.status(200).json({
    status: 'success',
    message: 'Highlight deleted successfully.',
    data: null,
  });
});
