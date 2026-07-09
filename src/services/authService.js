const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Otp } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { generateOtp, sendOtpViaSms } = require('../utils/otpgenerator');
const { Op } = require('sequelize');

/**
 * Register a new user, send OTP for verification
 */
exports.registerUser = async (userData) => {
  const { full_name, phone, password, role } = userData;

  // Check if phone already registered
  const existingUser = await User.findOne({ where: { phone } });
  if (existingUser) {
    throw new AppError('Phone number already registered.', 400);
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

  await Otp.create({
    phone: user.phone,
    user_id: user.id,
    otp,
    expires_at: expiresAt,
  });

  // Send OTP via SMS (mock)
  await sendOtpViaSms(phone, otp);

  return { userId: user.id, phone };
};

/**
 * Verify OTP and activate the user
 */
exports.verifyOtp = async (phone, otp) => {
  const user = await User.findOne({
    where: { phone },
    include: [{ model: Otp, as: 'otpRecord' }],
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.is_verified) {
    throw new AppError('User already verified.', 400);
  }

  const otpRecord = user.otpRecord;
  if (!otpRecord) {
    throw new AppError('No OTP requested. Please register again.', 400);
  }

  // Check OTP expiry
  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  // Check OTP match
  if (otpRecord.otp !== otp) {
    throw new AppError('Invalid OTP.', 400);
  }

  // Mark user as verified
  await user.update({ is_verified: true });

  // Delete the OTP record
  await Otp.destroy({ where: { id: otpRecord.id } });

  return { userId: user.id, phone: user.phone };
};

/**
 * Resend OTP to the user
 */
exports.resendOtp = async (phone) => {
  const user = await User.findOne({ where: { phone } });
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.is_verified) {
    throw new AppError('User already verified.', 400);
  }

  // Generate new OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Upsert OTP
  await Otp.upsert({
    user_id: user.id,
    otp,
    expires_at: expiresAt,
    updated_at: new Date(),
  });

  await sendOtpViaSms(phone, otp);

  return { userId: user.id, phone };
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

  // Update last login
  await user.update({ last_login: new Date() });

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Remove sensitive fields
  const userData = user.toJSON();
  delete userData.password_hash;

  return { user: userData, token };
};