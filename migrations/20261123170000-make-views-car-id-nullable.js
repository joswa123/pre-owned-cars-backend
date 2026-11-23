'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Drop foreign key on views.car_id if exists
    try {
      await queryInterface.sequelize.query('ALTER TABLE views DROP FOREIGN KEY views_ibfk_1');
    } catch (e) {
      // FK might not exist or have a different name
    }

    // 2. Modify views.car_id column to NULL
    await queryInterface.sequelize.query(
      'ALTER TABLE views MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL'
    );

    // 3. Re-add foreign key with ON DELETE CASCADE ON UPDATE CASCADE
    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE views ADD CONSTRAINT views_ibfk_1 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE ON UPDATE CASCADE'
      );
    } catch (e) {
      // Already re-added
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE views SET car_id = target_id WHERE car_id IS NULL AND target_type = 'car'"
    );

    try {
      await queryInterface.sequelize.query('ALTER TABLE views DROP FOREIGN KEY views_ibfk_1');
      await queryInterface.sequelize.query(
        'ALTER TABLE views MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL'
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE views ADD CONSTRAINT views_ibfk_1 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE ON UPDATE CASCADE'
      );
    } catch (e) {}
  },
};
