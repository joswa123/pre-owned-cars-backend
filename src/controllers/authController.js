const authService = require('../services/authService');
const { catchAsync } = require('../utils/errorHandler');

exports.register = catchAsync(async (req, res) => {
  const result = await authService.registerUser(req.body);

  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev
    ? `✅ OTP sent (dev mode). Your OTP: ${result.otp}`
    : 'OTP sent to your phone. Please verify.';

  res.status(201).json({
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      ...(isDev && { otp: result.otp }),
    },
  });
});

exports.verifyOtp = catchAsync(async (req, res) => {
  const { phone, otp } = req.body;
  const result = await authService.verifyOtp(phone, otp);
  res.status(200).json({
    status: 'success',
    message: 'Phone verified successfully. You can now login.',
    data: { userId: result.userId },
  });
});

exports.resendOtp = catchAsync(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.resendOtp(phone);
  res.status(200).json({
    status: 'success',
    message: 'OTP resent successfully.',
    data: { userId: result.userId },
  });
});

exports.login = catchAsync(async (req, res) => {
  const { phone, password } = req.body;
  const { user, token } = await authService.loginUser(phone, password);
  res.status(200).json({
    status: 'success',
    message: 'Login successful.',
    data: { user, token },
  });
});