const cityService = require('../services/admin-cityService');
const { catchAsync } = require('../utils/errorHandler');

exports.createCity = catchAsync(async (req, res) => {
    const { user_id, state_id, city_name, pin_code, status } = req.body;
    const city = await cityService.createCity({ user_id, state_id, city_name, pin_code, status });
    res.status(201).json({
        status: 'success',
        message: 'City created successfully.',
        data: { cityid: city.id },
    });
})

exports.getCities = catchAsync(async (req, res) => {
    const cities = await cityService.getCities();
    res.status(200).json({
        status: 'success',
        message: 'Cities retrieved successfully.',
        data: { cities }
    });
})
