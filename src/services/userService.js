const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database'); 
exports.updateProfile = async (userId, updateData) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('User not found.', 404);

  // Allowed DB fields
  const allowedFields = [
    'full_name', 'phone', 'email', 'address',
    'city', 'state', 'pincode', 'company_name', 'license_no',
    'gst_no', 'contact_person', 'seller_type', 'profile_picture'
  ];

  // Build update object
  const updateObj = {};
  for (const [key, value] of Object.entries(updateData)) {
    // Map frontend field 'name' to 'full_name' if sent
    const dbKey = key === 'name' ? 'full_name' : key;
    if (allowedFields.includes(dbKey) && value !== undefined && value !== null && value !== '') {
      updateObj[dbKey] = value;
    }
  }

  // If seller_type is provided, update it
  if (updateData.seller_type) {
    updateObj.seller_type = updateData.seller_type;
  }

  // Auto‑approve seller profiles
  if (user.role === 'seller' || user.role === 'company_seller') {
    updateObj.status = 'approved';
  }

  await user.update(updateObj);

  const userData = user.toJSON();
  delete userData.password_hash;
  return userData;
};

/**
 * Get user profile by ID (exclude password_hash)
 */
exports.getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash'] }
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
};