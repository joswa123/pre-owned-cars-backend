'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('notifications');

    // 1. Add target_type ENUM('car','commercial') NOT NULL DEFAULT 'car'
    if (!tableInfo.target_type) {
      await queryInterface.addColumn('notifications', 'target_type', {
        type: Sequelize.ENUM('car', 'commercial'),
        allowNull: false,
        defaultValue: 'car',
      });
    }

    // 2. Add target_id CHAR(36) NULL
    if (!tableInfo.target_id) {
      await queryInterface.addColumn('notifications', 'target_id', {
        type: 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin',
        allowNull: true,
      });
    }

    // 3. Backfill target_id = car_id where car_id IS NOT NULL
    await queryInterface.sequelize.query(
      "UPDATE notifications SET target_id = car_id, target_type = 'car' WHERE car_id IS NOT NULL AND (target_id IS NULL OR target_type IS NULL)"
    );

    // 4. Alter car_id to allow NULL (handle MySQL FK constraint with matching collation)
    const [fkRows] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'notifications' 
        AND COLUMN_NAME = 'car_id' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    const fkName = fkRows.length > 0 ? fkRows[0].CONSTRAINT_NAME : null;
    if (fkName) {
      await queryInterface.sequelize.query(`ALTER TABLE \`notifications\` DROP FOREIGN KEY \`${fkName}\``);
    }

    await queryInterface.sequelize.query(
      "ALTER TABLE `notifications` MODIFY `car_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL"
    );

    const fkToUse = fkName || 'notifications_ibfk_3';
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE \`notifications\` 
        ADD CONSTRAINT \`${fkToUse}\` 
        FOREIGN KEY (\`car_id\`) REFERENCES \`cars\`(\`id\`) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (e) {
      // foreign key already exists
    }

    // 5. Add index idx_notifications_target (target_type, target_id)
    try {
      await queryInterface.addIndex('notifications', ['target_type', 'target_id'], {
        name: 'idx_notifications_target',
      });
    } catch (e) {
      // index already exists
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('notifications', 'idx_notifications_target');
    } catch (e) {}

    // Restore car_id to NOT NULL
    try {
      const [fkRows] = await queryInterface.sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'notifications' 
          AND COLUMN_NAME = 'car_id' 
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      const fkName = fkRows.length > 0 ? fkRows[0].CONSTRAINT_NAME : null;
      if (fkName) {
        await queryInterface.sequelize.query(`ALTER TABLE \`notifications\` DROP FOREIGN KEY \`${fkName}\``);
      }
      await queryInterface.sequelize.query(
        "ALTER TABLE `notifications` MODIFY `car_id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL"
      );
      if (fkName) {
        await queryInterface.sequelize.query(`
          ALTER TABLE \`notifications\` 
          ADD CONSTRAINT \`${fkName}\` 
          FOREIGN KEY (\`car_id\`) REFERENCES \`cars\`(\`id\`) 
          ON DELETE CASCADE ON UPDATE CASCADE
        `);
      }
    } catch (e) {}

    const tableInfo = await queryInterface.describeTable('notifications');
    if (tableInfo.target_id) {
      await queryInterface.removeColumn('notifications', 'target_id');
    }
    if (tableInfo.target_type) {
      await queryInterface.removeColumn('notifications', 'target_type');
    }
  },
};
