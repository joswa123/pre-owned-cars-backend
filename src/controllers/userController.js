const userService = require('../services/userService');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { User } = require('../models');

exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updateData = { ...req.body };
  
  if (req.file) {
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