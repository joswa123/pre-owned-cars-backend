const dashboardService = require('../services/dashboardService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Get dashboard summary for authenticated user
 * GET /api/v1/users/me/dashboard
 */
exports.getDashboardSummary = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  const data = await dashboardService.getDashboardSummary(userId, role);

  res.status(200).json({
    status: 'success',
    data,
  });
});
