const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Otp,RefreshToken } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { generateOtp, sendOtpViaSms } = require('../utils/otpgenerator');
const { Op } = require('sequelize');
const sequelize = require('../config/database');


// Helper: generate tokens

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
  );

  // Calculate expiry date for DB
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '90')
  );

  // Store refresh token in DB (revoke any old ones later)
  await RefreshToken.create({
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken };
};

/**
 * Register a new user, send OTP for verification
 */
exports.registerUser = async (userData) => {
  const { full_name, phone, password, role } = userData;

  // Check if phone already registered
  const existingUser = await User.findOne({ where: { phone } });
   if (existingUser) {
    throw new AppError('Phone number already registered. Please login.', 200);
  }
  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user (unverified)
  const user = await User.create({
    full_name,
    phone,
    password_hash: passwordHash,
    role: role || 'buyer',
    is_verified: false,
  });

  // Generate and store OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Delete any existing OTP for this user
  await Otp.destroy({ where: { user_id: user.id } });

  // Store OTP (only user_id, otp, expires_at – phone is not needed)
  await Otp.create({
    user_id: user.id,
    phone: user.phone,
    otp,
    expires_at: expiresAt,
  });

  // Send OTP via SMS (mock – logs to console in dev)
  await sendOtpViaSms(phone, otp);

  // Prepare base response
  const response = { userId: user.id, phone };

  // ✅ In development, include the OTP so you can test without SMS
  if (process.env.NODE_ENV === 'development') {
    response.otp = otp;
  }

  return response;
};

/**
 * Verify OTP and activate the user
 */
/**
 * Verify OTP for registration and auto‑login
 */
exports.verifyOtp = async (phone, otp) => {
  // Find user with OTP relation
  const user = await User.findOne({
    where: { phone },
    include: [{ model: Otp, as: 'otpRecord' }],
  });

  if (!user) throw new AppError('User not found.', 404);
  if (user.is_verified) throw new AppError('User already verified.', 400);

  const otpRecord = user.otpRecord;
  if (!otpRecord) throw new AppError('No OTP requested. Please register again.', 400);
  if (new Date() > new Date(otpRecord.expires_at))
    throw new AppError('OTP has expired. Please request a new one.', 400);
  if (otpRecord.otp !== otp) throw new AppError('Invalid OTP.', 400);

  // Mark as verified
  await user.update({ is_verified: true });

  // Delete used OTP
  await Otp.destroy({ where: { id: otpRecord.id } });


  // Remove sensitive data
  const userData = user.toJSON();
  delete userData.password_hash;

  return { user: userData};
};

/**
 * Resend OTP to the user
 */
exports.resendOtp = async (phone) => {
  const user = await User.findOne({ where: { phone } });
  if (!user) throw new AppError('User not found.', 404);
  if (user.is_verified) throw new AppError('User already verified.', 400);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.destroy({ where: { user_id: user.id, type: 'register' } });
  await Otp.create({ user_id: user.id, otp, type: 'register', expires_at: expiresAt });

  await sendOtpViaSms(phone, otp);

  const response = { userId: user.id, phone };
  if (process.env.NODE_ENV === 'development') {
    response.otp = otp;
  }
  return response;
};

/**
 * Login user with phone and password
 */
exports.loginUser = async (phone, password) => {
  const user = await User.findOne({
    where: { phone },
    attributes: { include: ['password_hash'] },
  });

  if (!user) {
    throw new AppError('Invalid phone or password.', 401);
  }

  if (!user.is_verified) {
    throw new AppError('Please verify your phone number first.', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid phone or password.', 401);
  }

 // 4. Update last login
  await user.update({ last_login: new Date() });

  // 5. Revoke all previous refresh tokens (rotation)
  await RefreshToken.update(
    { is_revoked: true },
    { where: { user_id: user.id, is_revoked: false } }
  );

  // 6. Generate new tokens
  const tokens = await generateTokens(user);

  // 7. Remove sensitive fields
  const userData = user.toJSON();
  delete userData.password_hash;

  // 8. Return user + tokens
  return { user: userData, ...tokens };
};

/**
 * FORGOT PASSWORD – Send OTP to user's phone
 * @param {string} phone - 10-digit phone number
 * @returns {object} { userId, phone, otp (only in dev) }
 */
exports.forgotPassword = async (phone) => {
  const user = await User.findOne({ where: { phone } });
  if (!user) {
    throw new AppError('User not found with this phone number.', 404);
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.destroy({
    where: { user_id: user.id, type: 'reset_password' },
  });

  await Otp.create({
    user_id: user.id,
    otp,
    type: 'reset_password',
    expires_at: expiresAt,
  });

  await sendOtpViaSms(phone, otp);

  const response = { userId: user.id, phone };
  if (process.env.NODE_ENV === 'development') {
    response.otp = otp;
  }
  return response;
};


/**
 * RESET PASSWORD – Verify OTP and update password
 * @param {string} phone - 10-digit phone number
 * @param {string} otp - 6-digit OTP
 * @param {string} newPassword - new password (min 6 chars)
 * @returns {object} { userId }
 */
exports.resetPassword = async (phone, otp, newPassword) => {
  // 1. Find user
  const user = await User.findOne({ where: { phone } });
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // 2. Find the reset OTP record
  const otpRecord = await Otp.findOne({
    where: {
      user_id: user.id,
      otp,
      type: 'reset_password',
    },
  });

  if (!otpRecord) {
    throw new AppError('Invalid or expired OTP.', 400);
  }

  // 3. Check expiry
  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  // 4. Hash the new password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  // 5. Update user password
  await user.update({ password_hash: passwordHash, is_verified: true });

  // 6. Delete the used OTP
  await Otp.destroy({ where: { id: otpRecord.id } });

  return { userId: user.id };
};