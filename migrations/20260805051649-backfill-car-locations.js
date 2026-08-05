'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE cars c
      JOIN users u ON c.user_id = u.id
      SET 
        c.state_id = u.state_id,
        c.district_id = u.district_id,
        c.city_id = u.city_id
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE cars
      SET state_id = NULL, district_id = NULL, city_id = NULL
    `);
  }
};
