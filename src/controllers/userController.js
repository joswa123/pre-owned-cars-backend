const userService = require('../services/userService');
const { catchAsync } = require('../utils/errorHandler');

exports.updateProfile = catchAsync(async (req, res) => {
  const userId = req.params.id;
  const updateData = req.body;
  const file = req.file;

  const user = await userService.updateProfile(userId, updateData, file);

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully.',
    data: { user },
  });
});

exports.getProfile = catchAsync(async (req, res) => {
  const id = req.params.id;
  const user = await userService.getProfile(id);

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});