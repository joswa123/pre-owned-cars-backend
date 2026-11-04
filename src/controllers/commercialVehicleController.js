const commercialVehicleService = require('../services/commercialVehicleService');
const { catchAsync } = require('../utils/errorHandler');
const { queryCommercialVehicleSchema } = require('../validations/commercialValidation');

/**
 * Create Commercial Vehicle Listing
 */
exports.createCommercialVehicle = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const vehicleData = req.body;
  const files = req.files;

  const vehicle = await commercialVehicleService.createCommercialVehicle(userId, userRole, vehicleData, files);

  res.status(201).json({
    status: 'success',
    success: true,
    message: 'Commercial vehicle listed successfully.',
    data: {
      vehicle,
      ...vehicle,
    },
  });
});

/**
 * Get Public Commercial Vehicles List with Filters
 */
exports.getCommercialVehicles = catchAsync(async (req, res) => {
  const cleanedQuery = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    cleanedQuery[key] = value;
  }

  const { error } = queryCommercialVehicleSchema.validate(cleanedQuery, { allowUnknown: false });
  if (error) {
    return res.status(400).json({
      status: 'error',
      success: false,
      message: error.details[0].message,
    });
  }

  const {
    page = 1,
    limit = 20,
    sort_by,
    sortBy = 'created_at',
    sort_order,
    sortOrder = 'DESC',
    ...rawFilters
  } = cleanedQuery;

  const finalSortBy = sort_by || sortBy;
  const finalSortOrder = sort_order || sortOrder;
  const userId = req.user?.id || null;
  const userRole = req.user?.role || null;

  const result = await commercialVehicleService.getCommercialVehicles(
    rawFilters,
    Number(page),
    Number(limit),
    finalSortBy,
    finalSortOrder,
    userId,
    userRole
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get Commercial Vehicle by ID or Slug
 */
exports.getCommercialVehicleById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const viewerUser = req.user || null;
  const vehicle = await commercialVehicleService.getCommercialVehicleById(id, viewerUser);

  res.status(200).json({
    status: 'success',
    data: { vehicle },
  });
});

/**
 * Get Commercial Vehicles posted by current logged-in seller
 */
exports.getUserCommercialVehicles = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await commercialVehicleService.getSellerCommercialVehicles(userId, req.query);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Update Commercial Vehicle Listing
 */
exports.updateCommercialVehicle = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const updateData = req.body;
  const files = req.files;

  const vehicle = await commercialVehicleService.updateCommercialVehicle(
    id,
    userId,
    userRole,
    updateData,
    files
  );

  res.status(200).json({
    status: 'success',
    success: true,
    message: 'Commercial vehicle updated successfully.',
    data: { vehicle },
  });
});

/**
 * Delete Commercial Vehicle Listing
 */
exports.deleteCommercialVehicle = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  await commercialVehicleService.deleteCommercialVehicle(id, userId, userRole);

  res.status(200).json({
    status: 'success',
    message: 'Commercial vehicle deleted successfully.',
  });
});

/**
 * Mark Commercial Vehicle as Sold
 */
exports.markAsSold = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const vehicle = await commercialVehicleService.markAsSold(id, userId, userRole);

  res.status(200).json({
    status: 'success',
    message: 'Commercial vehicle marked as sold successfully.',
    data: { vehicle },
  });
});

/**
 * Add Images to Commercial Vehicle
 */
exports.addImages = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const vehicle = await commercialVehicleService.addImages(id, userId, userRole, req.files);

  res.status(200).json({
    status: 'success',
    message: 'Images added successfully.',
    data: { vehicle },
  });
});

/**
 * Delete Commercial Vehicle Image
 */
exports.deleteImage = catchAsync(async (req, res) => {
  const { id, imageId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const result = await commercialVehicleService.deleteImage(id, imageId, userId, userRole);

  res.status(200).json({
    status: 'success',
    message: result.message,
  });
});

/**
 * Set Primary Image for Commercial Vehicle
 */
exports.setPrimaryImage = catchAsync(async (req, res) => {
  const { id, imageId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const result = await commercialVehicleService.setPrimaryImage(id, imageId, userId, userRole);

  res.status(200).json({
    status: 'success',
    message: result.message,
  });
});

