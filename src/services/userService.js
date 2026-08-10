const { User, DealerProfile, CustomerProfile } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database'); 
const redisClient = require('../config/redis');

exports.updateProfile = async (userId, payload) => {
  const transaction = await sequelize.transaction();
  try {
    // 1. Find user
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new AppError('User not found.', 404);

    // 2. Extract user-level fields
    const userFields = [
      'full_name', 'profile_picture', 'email', 'phone',
      'use_registered_for_whatsapp', 'whatsapp_number', 'seller_type'
    ];
    // Map frontend field 'name' to 'full_name' if sent
    if (payload.name) payload.full_name = payload.name;

    const userUpdate = {};
    userFields.forEach(f => { if (payload[f] !== undefined) userUpdate[f] = payload[f]; });

    // Auto-approve seller profiles
    if (user.role === 'seller' || user.role === 'company_seller') {
      userUpdate.status = 'approved';
    }

    if (Object.keys(userUpdate).length > 0) {
      await user.update(userUpdate, { transaction });
    }

    // 3. Determine role and update corresponding profile
    let ProfileModel;
    const profileFields = {};
    
    // We treat 'seller' and 'company_seller' basically as dealer profiles for location logic?
    // User role can be 'dealer', 'customer', 'admin' as per the Model enum!
    // If they have role 'dealer', update DealerProfile
    if (user.role === 'dealer') {
      ProfileModel = DealerProfile;
      const dealerFields = ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'gst_no', 'license_no', 'contact_person'];
      dealerFields.forEach(f => { if (payload[f] !== undefined) profileFields[f] = payload[f]; });
    } else if (user.role === 'customer') {
      ProfileModel = CustomerProfile;
      const customerFields = ['preferences', 'alt_phone'];
      customerFields.forEach(f => { if (payload[f] !== undefined) profileFields[f] = payload[f]; });
    }

    if (ProfileModel && Object.keys(profileFields).length > 0) {
      const [profile, created] = await ProfileModel.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, ...profileFields },
        transaction,
      });
      if (!created) {
        await profile.update(profileFields, { transaction });
      }
    }

    await transaction.commit();
    
    // Cache Invalidation
    if (user.role === 'dealer') {
      await redisClient.del(`dealer:${userId}`);
    }

    // 4. Return updated user with profile
    return await exports.getProfile(userId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get user profile by ID (exclude password_hash)
 */
exports.getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash'] },
    include: [
      { model: CustomerProfile, as: 'customerProfile' },
      { model: DealerProfile, as: 'dealerProfile' }
    ]
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
};