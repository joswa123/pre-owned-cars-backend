const authService = require('../services/authService');
const { catchAsync } = require('../utils/errorHandler');
const jwt = require('jsonwebtoken');
const { RefreshToken, User } = require('../models');

/**
 * Register User or Dealer with Profile and Location Resolution
 */
exports.register = catchAsync(async (req, res) => {
  const result = await authService.registerUser(req.body);

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message = isDev
    ? `✅ Registration successful. OTP sent (dev mode): ${result.otp}`
    : 'Registration successful. OTP sent to your registered phone/email.';

  res.status(200).json({
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      email: result.email,
      role: result.role,
      profile: result.profile,
      ...(isDev && { otp: result.otp }),
    },
  });
});

/**
 * Verify Endpoint (POST /api/v1/auth/verify)
 * Verifies email/phone OTP code, activates user, returns JWT tokens and profile data.
 */
exports.verify = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyUser(req.body);

  res.status(200).json({
    status: 'success',
    message: 'Account verified successfully. You are now logged in.',
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

/**
 * Verify OTP Endpoint (POST /api/v1/auth/verify-otp)
 * Kept for backward compatibility
 */
exports.verifyOtp = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyUser(req.body);

  res.status(200).json({
    status: 'success',
    message: 'Phone verified successfully. You are now logged in.',
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

/**
 * Resend OTP Endpoint
 */
exports.resendOtp = catchAsync(async (req, res) => {
  const result = await authService.resendOtp(req.body);

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message = isDev
    ? `✅ OTP resent (dev mode). Your OTP: ${result.otp}`
    : 'Verification code resent successfully.';

  res.status(200).json({
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      email: result.email,
      ...(isDev && { otp: result.otp }),
    },
  });
});

/**
 * Login User or Dealer
 */
exports.login = catchAsync(async (req, res) => {
  const { phone, email, password } = req.body;
  const result = await authService.loginUser({ phone, email }, password);

  res.status(200).json({
    status: 'success',
    message: 'Login successful.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});

/**
 * Forgot Password - Request OTP
 */
exports.forgotPassword = catchAsync(async (req, res) => {
  const result = await authService.forgotPassword(req.body);

  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev
    ? `✅ OTP sent (dev mode). Your OTP: ${result.otp}`
    : 'Reset code sent to your registered phone/email.';

  res.status(200).json({
    status: 'success',
    message,
    data: {
      userId: result.userId,
      phone: result.phone,
      email: result.email,
      ...(isDev && { otp: result.otp }),
    },
  });
});

/**
 * Reset Password with OTP
 */
exports.resetPassword = catchAsync(async (req, res) => {
  const { phone, email, otp, newPassword } = req.body;
  const result = await authService.resetPassword({ phone, email }, otp, newPassword);

  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully. You can now login with your new password.',
    data: { userId: result.userId },
  });
});

/**
 * Refresh Access Token using Refresh Token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        status: 'error',
        success: false,
        message: 'Refresh token required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        status: 'error',
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    const storedToken = await RefreshToken.findOne({
      where: {
        token: refreshToken,
        is_revoked: false,
        user_id: decoded.id,
      },
    });

    if (!storedToken) {
      return res.status(401).json({
        status: 'error',
        success: false,
        message: 'Refresh token not found or revoked',
      });
    }

    if (new Date() > new Date(storedToken.expires_at)) {
      return res.status(401).json({
        status: 'error',
        success: false,
        message: 'Refresh token expired',
      });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        success: false,
        message: 'User no longer exists.',
      });
    }

    // Mark current refresh token as revoked in DB
    await RefreshToken.update(
      { is_revoked: true },
      { where: { token: refreshToken } }
    );

    // Issue new token pair
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '90')
    );

    await RefreshToken.create({
      user_id: user.id,
      token: newRefreshToken,
      expires_at: expiresAt,
      is_revoked: false,
    });

    // Return both top-level and data wrapper for complete client compatibility (Flutter, React, Postman)
    return res.status(200).json({
      status: 'success',
      success: true,
      message: 'Token refreshed successfully.',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          full_name: user.full_name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password (Protected)
 */
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.status(200).json({ status: 'success', ...result });
});