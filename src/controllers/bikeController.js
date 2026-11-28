const bikeService = require('../services/bikeService');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { queryBikeSchema } = require('../validations/bikeValidation');

exports.createBike = catchAsync(async (req, res) => {
  const bike = await bikeService.createBike(req.user.id, req.user.role, req.body, req.files);
  res.status(201).json({
    status: 'success',
    success: true,
    message: 'Bike listed successfully.',
    data: {
      bike,
      ...bike,
    },
  });
});

exports.getBikes = catchAsync(async (req, res) => {
  const cleanedQuery = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    cleanedQuery[key] = value;
  }

  const { error } = queryBikeSchema.validate(cleanedQuery, { allowUnknown: false });
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

  const result = await bikeService.getBikes(
    rawFilters,
    Number(page),
    Number(limit),
    sort_by || sortBy,
    sort_order || sortOrder,
    req.user?.id || null,
    req.user?.role || null
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

exports.getBikeById = catchAsync(async (req, res) => {
  const bike = await bikeService.getBikeById(req.params.id, req.user || null);
  res.status(200).json({
    status: 'success',
    data: {
      ...bike,
      bike,
    },
  });
});

exports.getUserBikes = catchAsync(async (req, res) => {
  const result = await bikeService.getSellerBikes(req.user.id, req.query, req.user);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

exports.getSellerListings = catchAsync(async (req, res) => {
  let sellerId = req.params.sellerId || req.params.userId || req.query.sellerId || req.query.userId;
  if (sellerId === 'me') {
    if (!req.user?.id) throw new AppError('You are not logged in. Please log in.', 401);
    sellerId = req.user.id;
  }
  const result = await bikeService.getSellerBikes(sellerId, req.query, req.user || null);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

exports.updateBike = catchAsync(async (req, res) => {
  const bike = await bikeService.updateBike(req.params.id, req.user.id, req.user.role, req.body, req.files);
  res.status(200).json({
    status: 'success',
    message: 'Bike updated successfully.',
    data: {
      bike,
      ...bike,
    },
  });
});

exports.markAsSold = catchAsync(async (req, res) => {
  const bike = await bikeService.markAsSold(req.params.id, req.user.id, req.user.role);
  res.status(200).json({
    status: 'success',
    message: 'Bike marked as sold.',
    data: { bike },
  });
});

exports.deleteBike = catchAsync(async (req, res) => {
  const result = await bikeService.deleteBike(req.params.id, req.user.id, req.user.role);
  res.status(200).json({
    status: 'success',
    ...result,
  });
});

exports.addImages = catchAsync(async (req, res) => {
  const images = await bikeService.addImages(req.params.id, req.user.id, req.user.role, req.files, req.body);
  res.status(201).json({
    status: 'success',
    message: 'Images added successfully.',
    data: { images },
  });
});

exports.deleteImage = catchAsync(async (req, res) => {
  const result = await bikeService.deleteImage(req.params.id, req.params.imageId, req.user.id, req.user.role);
  res.status(200).json({
    status: 'success',
    ...result,
  });
});

exports.setPrimaryImage = catchAsync(async (req, res) => {
  const result = await bikeService.setPrimaryImage(req.params.id, req.params.imageId, req.user.id, req.user.role);
  res.status(200).json({
    status: 'success',
    ...result,
  });
});

exports.uploadVideo = catchAsync(async (req, res) => {
  const result = await bikeService.uploadVideo(req.params.id, req.user.id, req.user.role, req.file);
  res.status(200).json({ status: 'success', data: result });
});

exports.uploadAudio = catchAsync(async (req, res) => {
  const result = await bikeService.uploadAudio(req.params.id, req.user.id, req.user.role, req.file);
  res.status(200).json({ status: 'success', data: result });
});

exports.getSimilarRecommended = catchAsync(async (req, res) => {
  const bikeId = req.query.bikeId || req.query.vehicleId || req.query.id || req.params.id || null;
  const limit = req.query.limit || 4;
  const result = await bikeService.getSimilarRecommended(bikeId, limit, req.user?.id || null);
  res.status(200).json({ status: 'success', data: result });
});

exports.getSimilarBikes = catchAsync(async (req, res) => {
  const bikeId = req.params.id || req.query.bikeId || req.query.id;
  const limit = req.query.limit || 4;
  const result = await bikeService.getSimilarBikes(bikeId, limit, req.user?.id || null);
  res.status(200).json({ status: 'success', data: { bikes: result } });
});

exports.getRecommended = catchAsync(async (req, res) => {
  const bikeId = req.params.id || req.query.bikeId || req.query.id || null;
  const limit = req.query.limit || 4;
  const result = await bikeService.getRecommendedBikes(bikeId, limit, req.user?.id || null);
  res.status(200).json({ status: 'success', data: { bikes: result } });
});

exports.recordView = catchAsync(async (req, res) => {
  const result = await bikeService.recordView(req.params.id, req.user ? req.user.id : null);
  res.status(200).json({ status: 'success', message: 'View recorded successfully.', data: result });
});

exports.enquire = catchAsync(async (req, res) => {
  const leadService = require('../services/leadService');
  const source = req.body.source || (['call', 'whatsapp', 'message'].includes(req.body.type) ? req.body.type : 'message');
  const lead = await leadService.createLead(req.user.id, {
    ...req.body,
    target_id: req.params.id,
    target_type: 'bike',
    source,
  });
  res.status(201).json({
    status: 'success',
    message: `${source} enquiry recorded successfully.`,
    data: lead,
  });
});

exports.getBikeTypes = catchAsync(async (req, res) => {
  const types = await bikeService.getBikeVehicleTypesWithCounts();
  res.status(200).json({ status: 'success', data: types });
});

exports.getBikeBrands = catchAsync(async (req, res) => {
  const brands = await bikeService.getBikeBrandsWithCounts({
    ...req.query,
    vehicle_type_id: req.params.vehicleTypeId || req.params.typeId || req.query.vehicle_type_id,
  });
  res.status(200).json({ status: 'success', data: brands });
});

exports.getBikeModels = catchAsync(async (req, res) => {
  const result = await bikeService.getBikeModelsByBrand(req.params.brandId);
  res.status(200).json({
    status: 'success',
    data: result.models,
    brand: result.brand,
  });
});
