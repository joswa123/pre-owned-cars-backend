'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const carTableDescription = await queryInterface.describeTable('cars');
    const transaction = await queryInterface.sequelize.transaction();

    try {
      if (!carTableDescription.previous_price) {
        await queryInterface.addColumn(
          'cars',
          'previous_price',
          {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: null,
            comment: 'Price prior to the last qualified price drop',
          },
          { transaction }
        );
      }

      if (!carTableDescription.has_price_drop) {
        await queryInterface.addColumn(
          'cars',
          'has_price_drop',
          {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Indicates whether the car currently has an active price drop',
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Add composite index safely outside transaction to avoid DDL implicit commit issues in MySQL
    try {
      await queryInterface.addIndex('cars', ['status', 'has_price_drop', 'price'], {
        name: 'idx_cars_status_price_drop',
      });
    } catch (err) {
      if (
        (err.name === 'SequelizeDatabaseError' && (err.message.includes('Duplicate key name') || err.message.includes('already exists'))) ||
        (err.message && err.message.includes('ER_DUP_KEYNAME'))
      ) {
        console.log('Index idx_cars_status_price_drop already exists, skipping...');
      } else {
        throw err;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('cars', 'idx_cars_status_price_drop');
    } catch (err) {
      console.log('Failed or skipped removing index idx_cars_status_price_drop:', err.message);
    }

    const carTableDescription = await queryInterface.describeTable('cars');
    const transaction = await queryInterface.sequelize.transaction();

    try {
      if (carTableDescription.has_price_drop) {
        await queryInterface.removeColumn('cars', 'has_price_drop', { transaction });
      }

      if (carTableDescription.previous_price) {
        await queryInterface.removeColumn('cars', 'previous_price', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
