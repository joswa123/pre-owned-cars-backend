const authService = require('../services/authService');
const { catchAsync } = require('../utils/errorHandler');

exports.register = catchAsync(async (req, res) => {
  const result = await authService.registerUser(req.body);

  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev
    ? `✅ OTP sent (dev mode). Your OTP: ${result.otp}`
    : 'OTP sent to your phone. Please verify.';

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

exports.verifyOtp = async (phone, otp) => {
  const user = await User.findOne({
    where: { phone },
    include: [{ model: Otp, as: 'otpRecord' }],
  });

  if (!user) throw new AppError('User not found.', 404);
  if (user.is_verified) throw new AppError('User already verified.', 200);

  const otpRecord = user.otpRecord;
  if (!otpRecord) throw new AppError('No OTP requested. Please register again.', 400);
  if (new Date() > new Date(otpRecord.expires_at)) 
    throw new AppError('OTP has expired. Please request a new one.', 400);
  if (otpRecord.otp !== otp) throw new AppError('Invalid OTP.', 400);

  // Mark user as verified
  await user.update({ is_verified: true });
  await Otp.destroy({ where: { id: otpRecord.id } });

  // --- 🔥 NEW: Generate JWT and auto-login ---
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Build user data (exclude sensitive fields)
  const userData = user.toJSON();
  delete userData.password_hash;

  return { 
    success: true,
    data: {
      user: userData,
      token,
    }
  };
};

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