const wishlistService = require('../services/wishlistService');
const { transformCarImages } = require('../services/carService');
const { catchAsync } = require('../utils/errorHandler');

exports.addToWishlist = catchAsync(async (req, res) => {
  const { carId, car_id } = req.body;
  const finalCarId = car_id || carId;
  const userId = req.user.id;
  const wishlist = await wishlistService.addToWishlist(userId, finalCarId);
  res.status(201).json({ success: true, message: 'Added to wishlist', data: wishlist });
});

exports.removeFromWishlist = catchAsync(async (req, res) => {
  const { carId } = req.params;
  const userId = req.user.id;
  await wishlistService.removeFromWishlist(userId, carId);
  res.status(200).json({ success: true, message: 'Removed from wishlist' });
});

exports.getWishlist = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cars = await wishlistService.getWishlist(userId);
  // Transform images if needed (optional)
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const transformed = cars.map(car => ({
    ...transformCarImages(car, baseUrl),
    isWishlist: true
  }));
  res.status(200).json({ success: true, data: transformed });
});