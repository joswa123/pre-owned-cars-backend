const dealerService = require('../services/dealerService');
const { catchAsync } = require('../utils/errorHandler');

exports.getDealers = catchAsync(async (req, res) => {
  const { name, state_id, district_id, city_id, page = 1, limit = 20 } = req.query;
  const result = await dealerService.getActiveDealers(
    { name, state_id, district_id, city_id },
    page,
    limit
  );
  res.json({ status: 'success', data: result });
});

exports.getDealer = catchAsync(async (req, res) => {
  let dealerId = req.params.id;
  if (dealerId === 'me') {
    if (!req.user?.id) throw new AppError('You are not logged in. Please log in.', 401);
    dealerId = req.user.id;
  }
  const dealer = await dealerService.getDealerById(dealerId);
  res.json({ status: 'success', data: dealer });
});

exports.getDealerCars = catchAsync(async (req, res) => {
  let dealerId = req.params.id;
  if (dealerId === 'me') {
    if (!req.user?.id) throw new AppError('You are not logged in. Please log in.', 401);
    dealerId = req.user.id;
  }
  const { page = 1, limit = 20 } = req.query;
  const result = await dealerService.getDealerCars(dealerId, page, limit);
  res.json({ status: 'success', data: result });
});
