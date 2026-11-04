'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Alter leads.car_id to NULL
    try {
      await queryInterface.sequelize.query('ALTER TABLE leads DROP FOREIGN KEY leads_ibfk_1');
    } catch (e) {
      // FK might have different name or not exist
    }
    await queryInterface.sequelize.query(
      'ALTER TABLE leads MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE leads ADD CONSTRAINT leads_ibfk_1 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE'
      );
    } catch (e) {
      // Already re-added
    }

    // 2. Alter wishlists.car_id to NULL
    try {
      await queryInterface.sequelize.query('ALTER TABLE wishlists DROP FOREIGN KEY wishlists_ibfk_2');
    } catch (e) {
      // FK might not exist
    }
    await queryInterface.sequelize.query(
      'ALTER TABLE wishlists MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE wishlists ADD CONSTRAINT wishlists_ibfk_2 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE'
      );
    } catch (e) {
      // Already re-added
    }

    // 3. Alter car_reports.car_id to NULL
    try {
      await queryInterface.sequelize.query('ALTER TABLE car_reports DROP FOREIGN KEY car_reports_ibfk_1');
    } catch (e) {
      // FK might not exist
    }
    await queryInterface.sequelize.query(
      'ALTER TABLE car_reports MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
    );
    try {
      await queryInterface.sequelize.query(
        'ALTER TABLE car_reports ADD CONSTRAINT car_reports_ibfk_1 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE'
      );
    } catch (e) {
      // Already re-added
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert car_id to NOT NULL (only if no NULL rows exist)
    await queryInterface.sequelize.query(
      "UPDATE leads SET car_id = target_id WHERE car_id IS NULL AND target_type = 'car'"
    );
    await queryInterface.sequelize.query(
      "UPDATE wishlists SET car_id = target_id WHERE car_id IS NULL AND target_type = 'car'"
    );
    await queryInterface.sequelize.query(
      "UPDATE car_reports SET car_id = target_id WHERE car_id IS NULL AND target_type = 'car'"
    );

    try {
      await queryInterface.sequelize.query('ALTER TABLE leads DROP FOREIGN KEY leads_ibfk_1');
      await queryInterface.sequelize.query(
        'ALTER TABLE leads MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE leads ADD CONSTRAINT leads_ibfk_1 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE'
      );
    } catch (e) {}

    try {
      await queryInterface.sequelize.query('ALTER TABLE wishlists DROP FOREIGN KEY wishlists_ibfk_2');
      await queryInterface.sequelize.query(
        'ALTER TABLE wishlists MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE wishlists ADD CONSTRAINT wishlists_ibfk_2 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE'
      );
    } catch (e) {}

    try {
      await queryInterface.sequelize.query('ALTER TABLE car_reports DROP FOREIGN KEY car_reports_ibfk_1');
      await queryInterface.sequelize.query(
        'ALTER TABLE car_reports MODIFY COLUMN car_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL'
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE car_reports ADD CONSTRAINT car_reports_ibfk_1 FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE'
      );
    } catch (e) {}
  },
};

