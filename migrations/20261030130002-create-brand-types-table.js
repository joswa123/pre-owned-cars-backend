'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.includes('brand_types');

    if (!tableExists) {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS brand_types (
          id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
          brand_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
          type_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY idx_brand_types_brand_type_unique (brand_id, type_id),
          KEY idx_brand_types_type_id (type_id),
          KEY idx_brand_types_brand_id (brand_id),
          CONSTRAINT fk_brand_types_brand_id FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_brand_types_type_id FOREIGN KEY (type_id) REFERENCES car_types (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('brand_types')) {
      await queryInterface.dropTable('brand_types');
    }
  },
};
