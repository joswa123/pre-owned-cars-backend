// controllers/leadController.js
const leadService = require('../services/leadService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Create a new lead/enquiry
 */
exports.createLead = catchAsync(async (req, res) => {
  const userId = req.user?.id || req.body.user_id;
  const lead = await leadService.createLead(userId, req.body);

  res.status(201).json({
    status: 'success',
    message: 'Enquiry sent successfully',
    data: lead,
  });
});

/**
 * Get leads for cars owned by the logged-in user (seller)
 */
exports.getSellerLeads = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;

  const result = await leadService.getSellerLeads(sellerId, { status }, page, limit);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get enquiries made by the logged-in user (buyer)
 */
exports.getBuyerLeads = catchAsync(async (req, res) => {
  const buyerId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;

  const result = await leadService.getBuyerLeads(buyerId, { status }, page, limit);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Update lead status (by seller or admin)
 */
exports.updateLeadStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  const updatedLead = await leadService.updateLeadStatus(id, userId, userRole, status);

  res.status(200).json({
    status: 'success',
    message: 'Lead status updated successfully',
    data: updatedLead,
  });
});

/**
 * Legacy: Enquire on car by car ID in param
 */
exports.enquire = catchAsync(async (req, res) => {
  const { id: carId } = req.params;
  const userId = req.user?.id;
  const lead = await leadService.createLead(userId, { ...req.body, car_id: carId });

  res.status(201).json({
    status: 'success',
    data: lead,
  });
});

/**
 * Legacy: Unlock lead contact
 */
exports.unlockLead = catchAsync(async (req, res) => {
  const { leadId } = req.params;
  const sellerId = req.user.id;
  const lead = await leadService.unlockLead(leadId, sellerId);

  res.status(200).json({
    status: 'success',
    data: lead,
  });
});

/**
 * Admin: Get all leads across the platform
 */
exports.getAllLeadsForAdmin = catchAsync(async (req, res) => {
  const result = await leadService.getAllLeadsForAdmin(req.query);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});