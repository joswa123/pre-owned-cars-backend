const wishlistService = require('../services/wishlistService');
const {
  wishlistQuerySchema,
  wishlistDeleteSchema,
  targetWishlistsQuerySchema,
} = require('../validations/wishlistValidation');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Resolve normalized targetId and targetType for wishlist write operations.
 */
const resolveWriteTarget = (req) => {
  const merged = { ...(req.query || {}), ...(req.body || {}), ...(req.params || {}) };
  const targetId =
    merged.target_id ||
    merged.targetId ||
    merged.car_id ||
    merged.carId ||
    merged.vehicle_id ||
    merged.vehicleId ||
    merged.commercial_id ||
    merged.commercialId ||
    merged.id;

  let targetType = merged.target_type || merged.targetType;
  if (!targetType) {
    if (merged.commercialId || merged.commercial_id) {
      targetType = 'commercial';
    } else if (merged.car_id || merged.carId) {
      targetType = 'car';
    } else if (merged.target_id && !merged.car_id && !merged.carId) {
      targetType = 'commercial';
    }
  }

  return {
    targetId,
    targetType,
  };
};

/**
 * Validate request params/query payloads with Joi and respond 400 on failure.
 */
const validateRequestPart = (schema, payload, res) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: true,
    allowUnknown: true,
    stripUnknown: false,
  });
  if (error) {
    res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
    return null;
  }
  return value;
};

/**
 * Factory for seller wishlist viewer handlers across vehicle target types.
 */
const handleGetTargetWishlists = (targetType, paramKey) =>
  catchAsync(async (req, res) => {
    const query = validateRequestPart(targetWishlistsQuerySchema, req.query || {}, res);
    if (!query) return;

    const targetId = req.params[paramKey];
    const serviceMethod =
      targetType === 'commercial'
        ? wishlistService.getCommercialWishlists
        : wishlistService.getCarWishlists;

    const result = await serviceMethod(req.user.id, targetId, {
      limit: query.limit,
      cursor: query.cursor,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  });

exports.addToWishlist = catchAsync(async (req, res) => {
  const { targetId, targetType } = resolveWriteTarget(req);
  const result = await wishlistService.addToWishlist(req.user.id, targetId, targetType);
  const wishlistData = result?.data || (result?.id ? result : null);
  const wishlistCount = result?.wishlist_count !== undefined ? result.wishlist_count : 1;
  res.status(200).json({
    success: true,
    message: 'Added to wishlist',
    data: wishlistData,
    is_wishlisted: true,
    isWishlist: true,
    wishlist_count: wishlistCount,
  });
});

exports.toggleWishlist = catchAsync(async (req, res) => {
  const { targetId, targetType } = resolveWriteTarget(req);
  const result = await wishlistService.toggleWishlist(req.user.id, targetId, targetType);
  res.status(200).json({
    success: true,
    message: result.message,
    data: result.data || null,
    is_wishlisted: result.is_wishlisted,
    isWishlist: result.isWishlist,
    wishlist_count: result.wishlist_count !== undefined ? result.wishlist_count : 0,
  });
});

exports.removeFromWishlist = catchAsync(async (req, res) => {
  const payload = { ...(req.body || {}), ...(req.query || {}), ...(req.params || {}) };
  const value = validateRequestPart(wishlistDeleteSchema, payload, res);
  if (!value) return;

  const finalTargetId =
    value.target_id ||
    value.targetId ||
    value.car_id ||
    value.carId ||
    value.vehicle_id ||
    value.vehicleId ||
    value.commercial_id ||
    value.commercialId ||
    value.id;
  const finalTargetType = value.target_type || value.targetType;

  const result = await wishlistService.removeFromWishlist(req.user.id, finalTargetId, finalTargetType);
  res.status(200).json({
    success: true,
    message: 'Removed from wishlist',
    is_wishlisted: false,
    isWishlist: false,
    wishlist_count: result?.wishlist_count !== undefined ? result.wishlist_count : 0,
  });
});

exports.getWishlist = catchAsync(async (req, res) => {
  const query = validateRequestPart(wishlistQuerySchema, req.query || {}, res);
  if (!query) return;

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const items = await wishlistService.getWishlist(req.user.id, {
    targetType: query.target_type,
    baseUrl,
    viewerUser: req.user,
  });

  res.status(200).json({ success: true, data: items });
});

/**
 * Get users who wishlisted a specific car (seller authorization check)
 * GET /api/v1/wishlist/car/:carId
 */
exports.getCarWishlists = handleGetTargetWishlists('car', 'carId');

/**
 * Get users who wishlisted a specific commercial vehicle (seller authorization check)
 * GET /api/v1/wishlist/commercial/:commercialId
 */
exports.getCommercialWishlists = handleGetTargetWishlists('commercial', 'commercialId');
