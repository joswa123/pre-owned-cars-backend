const viewService = require('../services/viewService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Get views listing for a specific car (seller authorization check)
 * GET /api/v1/views/car/:carId
 */
exports.getCarViews = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { carId } = req.params;
  const { limit = 20, cursor } = req.query;

  const result = await viewService.getCarViews(sellerId, carId, { limit, cursor });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
