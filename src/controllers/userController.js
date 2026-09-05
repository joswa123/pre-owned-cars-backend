const userService = require('../services/userService');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { User } = require('../models');

exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updateData = { ...req.body };
  
  if (req.files) {
    if (req.files.profile_picture) updateData.profile_picture = req.files.profile_picture[0].path;
    else if (req.files.customerProfile) updateData.profile_picture = req.files.customerProfile[0].path;
    else if (req.files.dealerProfile) updateData.profile_picture = req.files.dealerProfile[0].path;
  } else if (req.file) {
    updateData.profile_picture = req.file.path;
  }

  const user = await userService.updateProfile(userId, updateData);

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully.',
    data: { user },
  });
});

exports.getProfile = catchAsync(async (req, res) => {
  const user = await userService.getProfile(req.user.id); 
  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

/**
 * Get Seller Listings (Public)
 */
exports.getSellerListings = catchAsync(async (req, res) => {
  let { userId } = req.params;
  if (userId === 'me') {
    if (!req.user?.id) throw new AppError('You are not logged in. Please log in.', 401);
    userId = req.user.id;
  }
  const { excludeCarId, page = 1, limit = 10 } = req.query;
  const carService = require('../services/carService');

  const result = await carService.getSellerListings(
    userId,
    excludeCarId,
    Number(page),
    Number(limit)
  );

  res.status(200).json({
    status: 'success',
    data: result
  });
});