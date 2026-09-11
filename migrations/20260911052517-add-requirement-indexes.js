'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addIndex('requirements', ['status', 'expiry_date'], {
      name: 'idx_requirements_status_expiry'
    });
    
    await queryInterface.addIndex('requirements', ['brand_id', 'model_id'], {
      name: 'idx_requirements_brand_model'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('requirements', 'idx_requirements_status_expiry');
    await queryInterface.removeIndex('requirements', 'idx_requirements_brand_model');
  }
};
