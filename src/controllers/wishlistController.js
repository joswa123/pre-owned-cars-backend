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
const resolveWriteTarget = (body = {}) => {
  const { carId, car_id, target_id, target_type } = body;
  return {
    targetId: target_id || car_id || carId,
    targetType: target_type || (target_id && !car_id && !carId ? 'commercial' : 'car'),
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
  const { targetId, targetType } = resolveWriteTarget(req.body);
  const wishlist = await wishlistService.addToWishlist(req.user.id, targetId, targetType);
  res.status(200).json({ success: true, message: 'Added to wishlist', data: wishlist });
});

exports.toggleWishlist = catchAsync(async (req, res) => {
  const { targetId, targetType } = resolveWriteTarget(req.body);
  const result = await wishlistService.toggleWishlist(req.user.id, targetId, targetType);
  res.status(200).json({
    success: true,
    message: result.message,
    data: result.data || null,
    is_wishlisted: result.is_wishlisted,
    isWishlist: result.isWishlist,
  });
});

exports.removeFromWishlist = catchAsync(async (req, res) => {
  const payload = { ...(req.body || {}), ...(req.query || {}), ...(req.params || {}) };
  const value = validateRequestPart(wishlistDeleteSchema, payload, res);
  if (!value) return;

  const finalTargetId = value.target_id || value.car_id || value.carId;
  const finalTargetType = value.target_type || 'car';

  await wishlistService.removeFromWishlist(req.user.id, finalTargetId, finalTargetType);
  res.status(200).json({ success: true, message: 'Removed from wishlist' });
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
