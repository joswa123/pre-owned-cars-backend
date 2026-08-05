'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const carTableDescription = await queryInterface.describeTable('cars');

    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (!carTableDescription.color) {
        await queryInterface.addColumn('cars', 'color', {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: '',
          comment: 'Color of the car',
        }, { transaction });
      }

      if (!carTableDescription.number_plate) {
        await queryInterface.addColumn('cars', 'number_plate', {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: '',
          comment: 'Registration number plate of the car (e.g. TN01AB1234)',
        }, { transaction });
      }

      if (!carTableDescription.prior_appointemnts) {
        await queryInterface.addColumn('cars', 'prior_appointemnts', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Flag indicating whether prior appointment is required for this car',
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const carTableDescription = await queryInterface.describeTable('cars');

    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (carTableDescription.color) {
        await queryInterface.removeColumn('cars', 'color', { transaction });
      }
      if (carTableDescription.number_plate) {
        await queryInterface.removeColumn('cars', 'number_plate', { transaction });
      }
      if (carTableDescription.prior_appointemnts) {
        await queryInterface.removeColumn('cars', 'prior_appointemnts', { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
