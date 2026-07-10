const bcrypt = require('bcryptjs');
const { User } = require('../models');
const logger = require('./logger');

/**
 * Create a default admin user if none exists
 * Only runs in development mode
 */
const seedAdmin = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const adminPhone = process.env.ADMIN_PHONE || '9999999999';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    const existingAdmin = await User.findOne({
      where: { phone: adminPhone },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await User.create({
        full_name: 'Super Admin',
        phone: adminPhone,
        password_hash: hashedPassword,
        role: 'admin',
        is_verified: true,
      });
      logger.info(`✅ Admin user created: ${adminPhone}`);
    } else {
      logger.info('🔑 Admin user already exists');
    }
  } catch (error) {
    logger.error('❌ Failed to seed admin:', error);
  }
};

module.exports = seedAdmin;