const userService = require('../services/userService');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { User } = require('../models');

exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updateData = req.body;

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

exports.uploadProfilePicture = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const imageUrl = req.file.path; // Cloudinary URL
  const user = await User.findByPk(req.user.id);
  if (!user) throw new AppError('User not found', 404);
  
  await user.update({ profile_picture: imageUrl });
  
  const userData = user.toJSON();
  delete userData.password_hash;

  res.status(200).json({
    success: true,
    message: 'Profile picture updated',
    data: { profile_picture: imageUrl, user: userData }
  });
});