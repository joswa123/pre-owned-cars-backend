const authService = require('../services/authService');
const { catchAsync } = require('../utils/errorHandler');

/**
 * Register – returns OTP (in dev) and proceeds to OTP step
 */
exports.register = catchAsync(async (req, res) => {
  const result = await authService.registerUser(req.body);

  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev
    ? `✅ OTP sent (dev mode). Your OTP: ${result.otp}`
    : 'OTP sent to your phone. Please verify.';

  res.status(200).json({ // ✅ 201 Created
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      ...(isDev && { otp: result.otp }),
    },
  });
});

/**
 * Verify OTP – marks user as verified and auto‑logs in
 */
exports.verifyOtp = catchAsync(async (req, res) => {
  const { phone, otp } = req.body;

  // ✅ All logic is in the service
  const { user, token } = await authService.verifyOtp(phone, otp);

  res.status(200).json({
    status: 'success',
    message: 'Phone verified successfully. You are now logged in.',
    data: { user, token },
  });
});

/**
 * Resend OTP – for registration only
 */
exports.resendOtp = catchAsync(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.resendOtp(phone);

  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev
    ? `✅ OTP resent (dev mode). Your OTP: ${result.otp}`
    : 'OTP resent successfully.';

  res.status(200).json({
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      ...(isDev && { otp: result.otp }),
    },
  });
});

/**
 * Login
*/
exports.login = catchAsync(async (req, res) => {
  const { phone, password } = req.body;
  const { user, token } = await authService.loginUser(phone, password);
  res.status(200).json({
    status: 'success',
    message: 'Login successful.',
    data: { user, token },
  });
});

/**
 * Forgot Password – Send OTP
 */
exports.forgotPassword = catchAsync(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.forgotPassword(phone);

  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev
    ? `✅ OTP sent (dev mode). Your OTP: ${result.otp}`
    : 'OTP sent to your phone. Please check your SMS.';

  res.status(200).json({
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      ...(isDev && { otp: result.otp }),
    },
  });
});

/**
 * Reset Password – Verify OTP & Update Password
 */
exports.resetPassword = catchAsync(async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  const result = await authService.resetPassword(phone, otp, newPassword);
  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully. You can now login with your new password.',
    data: { userId: result.userId },
  });
});