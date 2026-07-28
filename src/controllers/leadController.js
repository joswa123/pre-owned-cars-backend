// controllers/leadController.js
const leadService = require('../services/leadService');
const { catchAsync } = require('../utils/errorHandler');

exports.enquire = catchAsync(async (req, res) => {
  const { id: carId } = req.params;
  const { name, phone, email, message } = req.body;
  const buyerId = req.user?.id; // optional, if logged in

  const lead = await leadService.createLead(carId, { name, phone, email, message });
  res.status(201).json({ success: true, data: lead });
});

exports.getSellerLeads = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const leads = await leadService.getSellerLeads(sellerId);
  res.status(200).json({ success: true, data: leads });
});

exports.unlockLead = catchAsync(async (req, res) => {
  const { leadId } = req.params;
  const sellerId = req.user.id;
  const lead = await leadService.unlockLead(leadId, sellerId);
  res.status(200).json({ success: true, data: lead });
});