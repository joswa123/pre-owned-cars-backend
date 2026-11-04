const wishlistService = require('../services/wishlistService');
const { transformCarImages } = require('../services/carService');
const { catchAsync } = require('../utils/errorHandler');

exports.addToWishlist = catchAsync(async (req, res) => {
  const { carId, car_id, target_id, target_type } = req.body;
  const finalTargetId = target_id || car_id || carId;
  const finalTargetType = target_type || (target_id && !car_id && !carId ? 'commercial' : 'car');
  const userId = req.user.id;
  const wishlist = await wishlistService.addToWishlist(userId, finalTargetId, finalTargetType);
  res.status(200).json({ success: true, message: 'Added to wishlist', data: wishlist });
});

exports.toggleWishlist = catchAsync(async (req, res) => {
  const { carId, car_id, target_id, target_type } = req.body;
  const finalTargetId = target_id || car_id || carId;
  const finalTargetType = target_type || (target_id && !car_id && !carId ? 'commercial' : 'car');
  const userId = req.user.id;
  const result = await wishlistService.toggleWishlist(userId, finalTargetId, finalTargetType);
  res.status(200).json({
    success: true,
    message: result.message,
    data: result.data || null,
    is_wishlisted: result.is_wishlisted,
    isWishlist: result.isWishlist,
  });
});

exports.removeFromWishlist = catchAsync(async (req, res) => {
  const { carId, target_id, target_type } = { ...req.params, ...req.body };
  const finalTargetId = target_id || carId;
  const finalTargetType = target_type || 'car';
  const userId = req.user.id;
  await wishlistService.removeFromWishlist(userId, finalTargetId, finalTargetType);
  res.status(200).json({ success: true, message: 'Removed from wishlist' });
});

exports.getWishlist = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cars = await wishlistService.getWishlist(userId);
  // Transform images if needed (optional)
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const transformed = (cars || [])
    .filter(Boolean)
    .map(car => ({
      ...transformCarImages(car, baseUrl),
      isWishlist: true
    }));
  res.status(200).json({ success: true, data: transformed });
});

/**
 * Get users who wishlisted a specific car (seller authorization check)
 * GET /api/v1/wishlists/car/:carId
 */
exports.getCarWishlists = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { carId } = req.params;
  const { limit = 20, cursor } = req.query;

  const result = await wishlistService.getCarWishlists(sellerId, carId, { limit, cursor });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
