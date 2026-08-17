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
  const dealer = await dealerService.getDealerById(req.params.id);
  res.json({ status: 'success', data: dealer });
});

exports.getDealerCars = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await dealerService.getDealerCars(req.params.id, page, limit);
  res.json({ status: 'success', data: result });
});
