const viewService = require('../services/viewService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Get views listing for a specific car (seller authorization check)
 * GET /api/v1/views/car/:carId
 */
exports.getCarViews = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const carId = req.params.carId || req.params.id;
  const { limit = 20, cursor } = req.query;

  const result = await viewService.getCarViews(sellerId, carId, { limit, cursor });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get views listing for a specific commercial vehicle (seller authorization check)
 * GET /api/v1/views/commercial/:id
 */
exports.getCommercialViews = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const commercialId = req.params.id || req.params.carId;
  const { limit = 20, cursor } = req.query;

  const result = await viewService.getCommercialViews(sellerId, commercialId, { limit, cursor });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
