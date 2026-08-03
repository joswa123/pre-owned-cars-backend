const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  User,
  CustomerProfile,
  DealerProfile,
  Otp,
  RefreshToken,
  State,
  District,
  City,
  Car,
} = require('../models');
const { AppError } = require('../utils/errorHandler');
const { generateOtp, sendOtpViaSms } = require('../utils/otpgenerator');
const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Helper: Generate Access and Refresh JWT Tokens
 */
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

  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '90')
  );

  // Store active refresh token in database
  await RefreshToken.create({
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken };
};

/**
 * Helper: Resolve Location Hierarchy (State -> District -> City)
 * Accepts either IDs or case-insensitive Names.
 * Throws 400 error if a requested location is not found.
 */
const resolveLocation = async ({ state_id, district_id, city_id, state, district, city }) => {
  let resolvedState = null;
  let resolvedDistrict = null;
  let resolvedCity = null;

  // 1. Resolve City (by ID or Name)
  if (city_id) {
    resolvedCity = await City.findByPk(city_id, {
      include: [
        { model: District, as: 'district' },
        { model: State, as: 'state' },
      ],
    });
    if (!resolvedCity) {
      throw new AppError(`City with ID '${city_id}' not found.`, 400);
    }
  } else if (city) {
    // Case-insensitive lookup using LOWER(name)
    resolvedCity = await City.findOne({
      where: sequelize.where(fn('LOWER', col('City.name')), city.trim().toLowerCase()),
      include: [
        { model: District, as: 'district' },
        { model: State, as: 'state' },
      ],
    });
    if (!resolvedCity) {
      throw new AppError(`City '${city}' not found in database.`, 400);
    }
  }

  // If City was resolved, extract its District and State parent links
  if (resolvedCity) {
    city_id = resolvedCity.id;
    district_id = district_id || resolvedCity.district_id;
    state_id = state_id || resolvedCity.state_id;
  }

  // 2. Resolve District if not set by city
  if (!district_id && district) {
    resolvedDistrict = await District.findOne({
      where: sequelize.where(fn('LOWER', col('District.name')), district.trim().toLowerCase()),
    });
    if (resolvedDistrict) {
      district_id = resolvedDistrict.id;
      state_id = state_id || resolvedDistrict.state_id;
    }
  }

  // 3. Resolve State if not set
  if (!state_id && state) {
    resolvedState = await State.findOne({
      where: sequelize.where(fn('LOWER', col('State.name')), state.trim().toLowerCase()),
    });
    if (resolvedState) {
      state_id = resolvedState.id;
    }
  }

  return {
    state_id: state_id || null,
    district_id: district_id || null,
    city_id: city_id || null,
    cityName: resolvedCity ? resolvedCity.name : city || null,
    stateName: resolvedState ? resolvedState.name : state || null,
  };
};

/**
 * Register User or Dealer using Managed Database Transaction
 */
exports.registerUser = async (userData) => {
  const {
    full_name,
    phone,
    email,
    password,
    role = 'customer',
    pincode,
    address,
    // Dealer-specific fields
    company_name,
    door_no,
    building_name,
    street_name,
    gst_no,
    license_no,
    contact_person,
  } = userData;

  // Check phone uniqueness
  const existingPhone = await User.findOne({ where: { phone } });
  if (existingPhone) {
    throw new AppError('Phone number already registered. Please login.', 400);
  }

  // Check email uniqueness if email provided
  if (email) {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      throw new AppError('Email address already registered. Please login.', 400);
    }
  }

  // Resolve location IDs and names
  const location = await resolveLocation(userData);

  // Hash password using bcrypt salt 12
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Execute User and Profile creation within an Atomic Database Transaction
  const transaction = await sequelize.transaction();

  try {
    // 1. Create Core User
    const user = await User.create(
      {
        full_name,
        phone,
        email: email || null,
        password_hash: passwordHash,
        role,
        is_verified: false,
        state_id: location.state_id,
        district_id: location.district_id,
        city_id: location.city_id,
        city: location.cityName,
        state: location.stateName,
        pincode: pincode || (userData.role === 'dealer' ? userData.pincode : null),
        address: address || null,
        seller_type: role === 'dealer' ? 'company' : 'individual',
      },
      { transaction }
    );

    // 2. Create Role-Specific Profile (CustomerProfile or DealerProfile)
    let profileData = null;
    if (role === 'dealer') {
      const dealerProfile = await DealerProfile.create(
        {
          user_id: user.id,
          company_name,
          door_no,
          building_name,
          street_name,
          pincode: pincode || userData.pincode,
          gst_no: gst_no || null,
          license_no: license_no || null,
          contact_person: contact_person || null,
          verified: false,
        },
        { transaction }
      );
      profileData = dealerProfile.toJSON();
    } else {
      const customerProfile = await CustomerProfile.create(
        {
          user_id: user.id,
          preferences: null,
        },
        { transaction }
      );
      profileData = customerProfile.toJSON();
    }

    // 3. Generate and store OTP code
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await Otp.destroy({ where: { user_id: user.id }, transaction });
    await Otp.create(
      {
        user_id: user.id,
        otp,
        type: 'register',
        expires_at: expiresAt,
      },
      { transaction }
    );

    // Commit Transaction
    await transaction.commit();

    // Send OTP via SMS
    await sendOtpViaSms(phone, otp);

    const response = {
      userId: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      profile: profileData,
    };

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      response.otp = otp;
    }

    return response;
  } catch (error) {
    // Rollback Transaction on error
    await transaction.rollback();
    throw error;
  }
};

/**
 * Verify OTP / Code and Activate User with JWT Generation
 */
exports.verifyUser = async ({ phone, email, code, otp }) => {
  const inputCode = code || otp;
  if (!inputCode) {
    throw new AppError('Verification code is required.', 400);
  }

  // Find user by phone or email
  const whereClause = {};
  if (phone) whereClause.phone = phone;
  else if (email) whereClause.email = email;

  const user = await User.findOne({
    where: whereClause,
    include: [
      { model: Otp, as: 'otpRecord' },
      { model: CustomerProfile, as: 'customerProfile' },
      { model: DealerProfile, as: 'dealerProfile' },
    ],
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const otpRecord = user.otpRecord;
  if (!otpRecord) {
    throw new AppError('No verification code requested or already verified.', 400);
  }

  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new AppError('Verification code has expired. Please request a new one.', 400);
  }

  if (otpRecord.otp !== inputCode) {
    throw new AppError('Invalid verification code.', 400);
  }

  // Mark user as verified
  await user.update({ is_verified: true });

  // Delete used OTP record
  await Otp.destroy({ where: { id: otpRecord.id } });

  // Generate Access and Refresh JWT Tokens
  const tokens = await generateTokens(user);

  // Format user response data
  const userData = user.toJSON();
  delete userData.password_hash;
  delete userData.otpRecord;

  return { user: userData, ...tokens };
};

/**
 * Resend Verification OTP
 */
exports.resendOtp = async ({ phone, email }) => {
  const whereClause = {};
  if (phone) whereClause.phone = phone;
  else if (email) whereClause.email = email;

  const user = await User.findOne({ where: whereClause });
  if (!user) throw new AppError('User not found.', 404);
  if (user.is_verified) throw new AppError('User is already verified.', 400);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.destroy({ where: { user_id: user.id, type: 'register' } });
  await Otp.create({
    user_id: user.id,
    otp,
    type: 'register',
    expires_at: expiresAt,
  });

  if (user.phone) {
    await sendOtpViaSms(user.phone, otp);
  }

  const response = { userId: user.id, phone: user.phone, email: user.email };
  if (process.env.NODE_ENV === 'development') {
    response.otp = otp;
  }
  return response;
};

/**
 * Login User / Dealer with Phone or Email and Password
 * Returns JWT tokens and eager-loaded Profile with Car activity metrics.
 */
exports.loginUser = async ({ phone, email }, password) => {
  const whereClause = {};
  if (phone) whereClause.phone = phone;
  else if (email) whereClause.email = email;

  const user = await User.findOne({
    where: whereClause,
    attributes: { include: ['password_hash'] },
    include: [
      { model: CustomerProfile, as: 'customerProfile' },
      { model: DealerProfile, as: 'dealerProfile' },
      { model: City, as: 'cityDetail' },
      { model: District, as: 'districtDetail' },
      { model: State, as: 'stateDetail' },
    ],
  });

  if (!user) {
    throw new AppError('Invalid credentials.', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials.', 401);
  }

  if (!user.is_verified) {
    throw new AppError('Account is not verified. Please verify your phone/email first.', 401);
  }

  // Update last login timestamp
  await user.update({ last_login: new Date() });

  // Revoke old refresh tokens
  await RefreshToken.update(
    { is_revoked: true },
    { where: { user_id: user.id, is_revoked: false } }
  );

  // Generate new token pair
  const tokens = await generateTokens(user);

  // Fetch Car metrics for scalability
  let activityMetrics = {};
  if (user.role === 'dealer') {
    const activeCarsCount = await Car.count({ where: { dealer_id: user.id, status: 'active' } });
    const soldCarsCount = await Car.count({ where: { dealer_id: user.id, status: 'sold' } });
    activityMetrics = { active_cars_count: activeCarsCount, sold_cars_count: soldCarsCount };
  } else if (user.role === 'customer') {
    const boughtCarsCount = await Car.count({ where: { buyer_id: user.id, status: 'sold' } });
    activityMetrics = { bought_cars_count: boughtCarsCount };
  }

  const userData = user.toJSON();
  delete userData.password_hash;
  userData.activity_metrics = activityMetrics;

  return { user: userData, ...tokens };
};

/**
 * Forgot Password - Generate OTP
 */
exports.forgotPassword = async ({ phone, email }) => {
  const whereClause = {};
  if (phone) whereClause.phone = phone;
  else if (email) whereClause.email = email;

  const user = await User.findOne({ where: whereClause });
  if (!user) throw new AppError('User not found.', 404);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await Otp.destroy({ where: { user_id: user.id, type: 'reset_password' } });
  await Otp.create({
    user_id: user.id,
    otp,
    type: 'reset_password',
    expires_at: expiresAt,
  });

  if (user.phone) {
    await sendOtpViaSms(user.phone, otp);
  }

  const response = { userId: user.id, phone: user.phone, email: user.email };
  if (process.env.NODE_ENV === 'development') {
    response.otp = otp;
  }
  return response;
};

/**
 * Reset Password with OTP
 */
exports.resetPassword = async ({ phone, email }, otp, newPassword) => {
  const whereClause = {};
  if (phone) whereClause.phone = phone;
  else if (email) whereClause.email = email;

  const user = await User.findOne({ where: whereClause });
  if (!user) throw new AppError('User not found.', 404);

  const otpRecord = await Otp.findOne({
    where: {
      user_id: user.id,
      otp,
      type: 'reset_password',
    },
  });

  if (!otpRecord) {
    throw new AppError('Invalid or expired reset code.', 400);
  }

  if (new Date() > new Date(otpRecord.expires_at)) {
    throw new AppError('Reset code has expired. Please request a new one.', 400);
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  await user.update({ password_hash: passwordHash, is_verified: true });
  await Otp.destroy({ where: { id: otpRecord.id } });

  return { userId: user.id };
};