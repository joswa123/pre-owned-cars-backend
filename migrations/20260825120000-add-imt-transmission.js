'use strict';
const { v4: uuidv4 } = require('uuid') || {};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const [existing] = await queryInterface.sequelize.query(
        "SELECT transmission_id FROM transmissions WHERE LOWER(transmission_name) = 'imt' LIMIT 1;"
      );
      if (!existing || existing.length === 0) {
        const id = (uuidv4 ? uuidv4() : require('crypto').randomUUID());
        await queryInterface.sequelize.query(
          "INSERT INTO transmissions (transmission_id, transmission_name, status, user_id, created_at, updated_at) VALUES (:id, 'IMT', 'active', NULL, NOW(), NOW());",
          {
            replacements: { id },
            type: Sequelize.QueryTypes.INSERT,
          }
        );
      }
    } catch (e) {
      console.warn('Add IMT transmission migration note:', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.sequelize.query(
        "DELETE FROM transmissions WHERE LOWER(transmission_name) = 'imt';"
      );
    } catch (e) {}
  },
};
