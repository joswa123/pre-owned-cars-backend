const userService = require('../services/userService');
const { catchAsync } = require('../utils/errorHandler');

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
  const userId = req.user.id;
  const user = await userService.getProfile(userId);

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});