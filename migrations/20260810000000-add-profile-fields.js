'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add to users
    await queryInterface.addColumn('users', 'use_registered_for_whatsapp', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });
    await queryInterface.addColumn('users', 'whatsapp_number', {
      type: Sequelize.STRING(15),
      allowNull: true,
    });

    // 2. Add alt_phone to profiles
    await queryInterface.addColumn('customer_profiles', 'alt_phone', {
      type: Sequelize.STRING(15),
      allowNull: true,
    });
    await queryInterface.addColumn('dealer_profiles', 'alt_phone', {
      type: Sequelize.STRING(15),
      allowNull: true,
    });

    // 3. Index company_name for fast search
    await queryInterface.addIndex('dealer_profiles', ['company_name']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'use_registered_for_whatsapp');
    await queryInterface.removeColumn('users', 'whatsapp_number');
    await queryInterface.removeColumn('customer_profiles', 'alt_phone');
    await queryInterface.removeColumn('dealer_profiles', 'alt_phone');
    await queryInterface.removeIndex('dealer_profiles', ['company_name']);
  },
};
