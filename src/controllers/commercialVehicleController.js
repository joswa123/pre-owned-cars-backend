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
    data: {
      ...vehicle,
      vehicle,
      car: vehicle,
    },
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

/**
 * Upload Commercial Vehicle Video
 */
exports.uploadVideo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const file = req.file;

  const video_url = await commercialVehicleService.uploadCommercialVideo(id, userId, userRole, file);

  res.status(200).json({
    status: 'success',
    success: true,
    message: 'Video uploaded successfully.',
    video_url,
  });
});

/**
 * Upload Commercial Vehicle Audio
 */
exports.uploadAudio = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const file = req.file;

  const audio_url = await commercialVehicleService.uploadCommercialAudio(id, userId, userRole, file);

  res.status(200).json({
    status: 'success',
    success: true,
    message: 'Audio uploaded successfully.',
    audio_url,
  });
});

/**
 * Get Similar and Recommended Commercial Vehicles
 */
exports.getSimilarRecommended = catchAsync(async (req, res) => {
  const vehicleId = req.query.vehicleId || req.query.commercialId || req.query.carId || req.query.id || req.params.id;
  const { limit = 4, page = 1 } = req.query;
  const currentUserId = req.query.userId || (req.user ? req.user.id : null);

  if (!vehicleId) {
    return res.status(400).json({ status: 'fail', message: 'commercial vehicle ID (vehicleId) is required' });
  }

  const result = await commercialVehicleService.getSimilarRecommended(
    vehicleId,
    currentUserId,
    Number(limit),
    Number(page),
    req.user
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get Similar Commercial Vehicles
 */
exports.getSimilarVehicles = catchAsync(async (req, res) => {
  const vehicleId = req.params.id || req.query.vehicleId || req.query.commercialId || req.query.id;
  const { limit = 4, page = 1 } = req.query;

  if (!vehicleId) {
    return res.status(400).json({ status: 'fail', message: 'commercial vehicle ID is required' });
  }

  const result = await commercialVehicleService.getSimilarCommercialVehicles(
    vehicleId,
    Number(limit),
    Number(page),
    req.user
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get Recommended Commercial Vehicles
 */
exports.getRecommended = catchAsync(async (req, res) => {
  const vehicleId = req.params.id || req.query.vehicleId || req.query.commercialId || req.query.id || null;
  const { limit = 4 } = req.query;
  const currentUserId = req.query.userId || (req.user ? req.user.id : null);

  const result = await commercialVehicleService.getRecommendedCommercialVehicles(
    vehicleId,
    currentUserId,
    Number(limit),
    req.user
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Get Specific Seller's Public Commercial Listings
 */
exports.getSellerListings = catchAsync(async (req, res) => {
  let sellerId = req.params.sellerId || req.params.userId || req.query.sellerId || req.query.userId;
  if (sellerId === 'me') {
    if (!req.user?.id) throw new AppError('You are not logged in. Please log in.', 401);
    sellerId = req.user.id;
  }

  if (!sellerId) {
    return res.status(400).json({ status: 'fail', message: 'sellerId is required' });
  }

  const { excludeVehicleId, excludeCarId, excludeId, page = 1, limit = 10 } = req.query;
  const exclude = excludeVehicleId || excludeId || excludeCarId || null;

  const result = await commercialVehicleService.getSellerCommercialListings(
    sellerId,
    exclude,
    Number(page),
    Number(limit),
    req.user
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

