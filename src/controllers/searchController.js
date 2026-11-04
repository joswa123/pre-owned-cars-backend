const searchService = require('../services/searchService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * GET /api/v1/search
 * Unified search endpoint for both passenger cars and commercial vehicles
 */
exports.search = catchAsync(async (req, res) => {
  const userId = req.user?.id || null;
  const userRole = req.user?.role || null;

  const result = await searchService.globalSearch(req.query, userId, userRole);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

