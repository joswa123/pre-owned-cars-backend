const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const validate = require('../../middlewares/validate');
const { protect } = require('../../middlewares/auth');
const {
  registerSchema,
  verifySchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('../../validations/authvalidation');

// Public Authentication Routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/verify', validate(verifySchema), authController.verify);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtp);
router.post('/login', validate(loginSchema), authController.login);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

// Protected Routes
router.post('/change-password', protect, validate(changePasswordSchema), authController.changePassword);

module.exports = router;