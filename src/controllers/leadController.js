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
 * Get lead summary grouped by unique cars for seller dashboard
 */
exports.getLeadSummary = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { status, limit = 20, cursor, target_type, type, targetType } = req.query;
  const resolvedTargetType = target_type || type || targetType || null;

  const result = await leadService.getLeadSummary(sellerId, {
    status,
    limit,
    cursor,
    target_type: resolvedTargetType,
  });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get drill-down leads timeline for a specific car or commercial vehicle
 */
exports.getCarLeads = catchAsync(async (req, res) => {
  const carId = req.params.carId || req.params.id || req.params.commercialId;
  const { limit = 20, cursor = null, source = null } = req.query;
  const sellerId = req.user.id;

  const result = await leadService.getCarLeads(sellerId, carId, { limit, cursor, source });
  res.json({ status: 'success', data: result });
});

/**
 * Batch mark leads as read/viewed
 */
exports.batchMarkAsRead = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { lead_ids } = req.body;

  const result = await leadService.batchMarkAsRead(sellerId, lead_ids);

  res.status(200).json({
    status: 'success',
    message: 'Leads marked as read successfully',
    data: result,
  });
});

/**
 * Mark a single lead as read/contacted
 */
exports.markAsRead = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { id } = req.params;

  const result = await leadService.updateLeadStatus(id, sellerId, req.user.role, 'contacted');

  res.status(200).json({
    status: 'success',
    message: 'Lead marked as contacted',
    data: result,
  });
});

/**
 * Get leads for cars owned by the logged-in user (seller)
 */
exports.getSellerLeads = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { status, page = 1, limit = 20, cursor, target_type, type, targetType } = req.query;
  const resolvedTargetType = target_type || type || targetType || null;

  const result = await leadService.getSellerLeads(
    sellerId,
    { status, cursor, target_type: resolvedTargetType },
    page,
    limit
  );

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
  const { status, page = 1, limit = 20, cursor, target_type, type, targetType } = req.query;
  const resolvedTargetType = target_type || type || targetType || null;

  const result = await leadService.getBuyerLeads(
    buyerId,
    { status, cursor, target_type: resolvedTargetType },
    page,
    limit
  );

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
 * Get single lead details by ID
 * GET /api/v1/leads/:id
 */
exports.getLeadById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await leadService.getLeadById(id);

  if (!lead) {
    return res.status(404).json({
      status: 'fail',
      message: 'Lead not found',
    });
  }

  // Authorization check: buyer, seller, or admin can view
  const userId = req.user.id;
  const userRole = req.user.role;
  if (userRole !== 'admin' && lead.seller_id !== userId && lead.buyer_id !== userId) {
    return res.status(403).json({
      status: 'fail',
      message: 'You are not authorized to view this lead',
    });
  }

  res.status(200).json({
    status: 'success',
    data: lead,
  });
});

/**
 * Direct Enquiry on car or commercial vehicle by ID in param
 * POST /api/v1/leads/:id/enquire
 */
exports.enquire = catchAsync(async (req, res) => {
  const { id: vehicleId } = req.params;
  const userId = req.user?.id;
  const source = req.body.source || (['call', 'whatsapp', 'message'].includes(req.body.type) ? req.body.type : 'message');

  const lead = await leadService.createLead(userId, {
    ...req.body,
    target_id: vehicleId,
    car_id: vehicleId,
    source,
  });

  res.status(201).json({
    status: 'success',
    message: `${source} enquiry recorded successfully.`,
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