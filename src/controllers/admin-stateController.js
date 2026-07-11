const stateService = require('../services/admin-stateService');
const { catchAsync } = require('../utils/errorHandler');

exports.createState = catchAsync(async (req, res) => {
    const { user_id, state_name, state_code, status } = req.body;
    const state = await stateService.createState({ user_id, state_name, state_code, status });
    res.status(201).json({
        status: 'success',
        message: 'State created successfully.',
        data: { stateid: state.id },
    });
})

exports.getStates = catchAsync(async (req, res) => {
    const states = await stateService.getStates();
    res.status(200).json({ 
        status: 'success',
        message: 'States retrieved successfully.',
        data: { states }
    });
});