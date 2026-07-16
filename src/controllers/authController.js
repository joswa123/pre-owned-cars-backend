const authService = require('../services/authService');
const { catchAsync } = require('../utils/errorHandler');
const jwt = require('jsonwebtoken');
const { RefreshToken, User } = require('../models');

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
    data: { user },
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
  const result = await authService.loginUser(phone, password);

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
/**
 * Refresh Access Token using Refresh Token
 *
 * Flow:
 * 1. Client sends refresh token
 * 2. Verify JWT signature
 * 3. Check token exists in DB and is not revoked
 * 4. Check token expiry
 * 5. Find user
 * 6. Revoke current refresh token (rotation)
 * 7. Generate new access token
 * 8. Generate new refresh token
 * 9. Save new refresh token in DB
 * 10. Return new token pair
 */
exports.refreshToken = async (req, res, next) => {
  try {
    // Extract refresh token from request body
    const { refreshToken } = req.body;

    // Validate request
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    let decoded;

    try {
      /**
       * Verify refresh token signature and expiry.
       * Throws error if:
       * - token is invalid
       * - token is tampered
       * - token is expired
       */
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    /**
     * Check if refresh token exists in database
     * and has not been revoked previously.
     *
     * This protects against:
     * - token reuse attacks
     * - logout tokens
     * - stolen old tokens
     */
    const storedToken = await RefreshToken.findOne({
      where: {
        token: refreshToken,
        is_revoked: false,
        user_id: decoded.id,
      },
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found or revoked',
      });
    }

    /**
     * Double-check database expiry.
     * Useful even though JWT already contains expiry.
     */
    if (new Date() > new Date(storedToken.expires_at)) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired',
      });
    }

    /**
     * Fetch current user.
     * User may have been deleted or disabled.
     */
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    /**
     * Refresh Token Rotation
     *
     * Mark current refresh token as revoked.
     * It can never be used again.
     */
    await storedToken.update({
      is_revoked: true,
    });

    /**
     * Generate new Access Token
     *
     * Used for API authorization.
     * Usually short-lived.
     */
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }
    );

    /**
     * Generate new Refresh Token
     *
     * Used to obtain future access tokens.
     * Usually longer-lived.
     */
    const newRefreshToken = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn:
          process.env.JWT_REFRESH_EXPIRES_IN || '90d',
      }
    );

    /**
     * Calculate refresh token expiry date
     * for database storage.
     */
    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() +
        parseInt(
          process.env.JWT_REFRESH_EXPIRES_IN || '90'
        )
    );

    /**
     * Store newly generated refresh token.
     */
    await RefreshToken.create({
      user_id: user.id,
      token: newRefreshToken,
      expires_at: expiresAt,
      is_revoked: false,
    });

    /**
     * Return fresh token pair.
     *
     * Client should:
     * - Replace old access token
     * - Replace old refresh token
     */
    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    next(error);
  }
};