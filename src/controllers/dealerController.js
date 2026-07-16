const { catchAsync } = require('../utils/errorHandler');
const dealerService = require('../services/dealerService');

exports.createDealer = catchAsync(async (req, res) => {
    const dealerData = req.body;
    const file = req.file;

    const dealer = await dealerService.createDealer(userId, dealerData, file);

    res.status(201).json({ status: 'success', message: 'Dealer created successfully.', data: { dealer } });
})

exports.getdealerprofile = catchAsync(async (req, res) => {
    const id = req.params.id;
    const dealer = await dealerService.getDealer(id);

    res.status(200).json({ status: 'success', data: { dealer } });
}) 

exports.updatedealerprofile = catchAsync(async (req, res) => {
    const dealerId = req.params.id;
    const dealerData = req.body;
    const file = req.file;
    console.log("dealerfile", file);

    const dealer = await dealerService.updateDealer(dealerId, dealerData, file);

    res.status(200).json({ status: 'success', message: 'Dealer profile updated successfully.', data: { dealer } });
})