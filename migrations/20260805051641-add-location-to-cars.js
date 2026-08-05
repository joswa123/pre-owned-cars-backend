'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('cars', 'state_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'states', key: 'id' },
        onDelete: 'SET NULL',
      }, { transaction });

      await queryInterface.addColumn('cars', 'district_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'districts', key: 'id' },
        onDelete: 'SET NULL',
      }, { transaction });

      await queryInterface.addColumn('cars', 'city_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'cities', key: 'id' },
        onDelete: 'SET NULL',
      }, { transaction });

      await queryInterface.addIndex('cars', ['state_id'], { transaction });
      await queryInterface.addIndex('cars', ['district_id'], { transaction });
      await queryInterface.addIndex('cars', ['city_id'], { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('cars', 'city_id', { transaction });
      await queryInterface.removeColumn('cars', 'district_id', { transaction });
      await queryInterface.removeColumn('cars', 'state_id', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
