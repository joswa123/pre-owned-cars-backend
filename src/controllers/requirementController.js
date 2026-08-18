const requirementService = require('../services/requirementService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Create a new requirement
 */
exports.createRequirement = catchAsync(async (req, res) => {
  const requirement = await requirementService.createRequirement(req.user.id, req.body);
  res.status(201).json({
    status: 'success',
    data: requirement,
  });
});

/**
 * Get requirements of the logged-in user
 */
exports.getMyRequirements = catchAsync(async (req, res) => {
  const result = await requirementService.getMyRequirements(req.user.id, req.query);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Update the status of a requirement
 */
exports.updateRequirementStatus = catchAsync(async (req, res) => {
  const requirement = await requirementService.updateRequirementStatus(req.params.id, req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    data: requirement,
  });
});

/**
 * Soft delete a requirement
 */
exports.deleteRequirement = catchAsync(async (req, res) => {
  const result = await requirementService.deleteRequirement(req.params.id, req.user.id);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});
