const bcrypt = require('bcryptjs');
const { User } = require('../models');
const logger = require('./logger');

/**
 * Create or sync the default Admin user
 * Configurable via ADMIN_PHONE, ADMIN_EMAIL, and ADMIN_PASSWORD env variables.
 */
const seedAdmin = async () => {
  const adminPhone = process.env.ADMIN_PHONE || '9999999999';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@autodeal.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    const existingAdmin = await User.findOne({
      where: { role: 'admin' },
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (!existingAdmin) {
      await User.create({
        full_name: 'Super Admin',
        phone: adminPhone,
        email: adminEmail,
        password_hash: hashedPassword,
        role: 'admin',
        is_verified: true,
      });
      logger.info(`✅ Admin user created with phone: ${adminPhone}, email: ${adminEmail}`);
    } else {
      // Update admin phone & password if changed in env
      await existingAdmin.update({
        phone: adminPhone,
        email: adminEmail,
        password_hash: hashedPassword,
        is_verified: true,
      });
      logger.info(`🔑 Admin user synced with phone: ${adminPhone}`);
    }
  } catch (error) {
    logger.error('❌ Failed to seed/sync admin:', error.message);
  }
};

module.exports = seedAdmin;