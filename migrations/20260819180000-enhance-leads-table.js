'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('leads');

    if (!tableInfo.contact_phone) {
      await queryInterface.addColumn('leads', 'contact_phone', {
        type: Sequelize.STRING(15),
        allowNull: true,
      });
    }

    if (!tableInfo.preferred_contact) {
      await queryInterface.addColumn('leads', 'preferred_contact', {
        type: Sequelize.ENUM('whatsapp', 'phone', 'email'),
        allowNull: false,
        defaultValue: 'phone',
      });
    }

    if (!tableInfo.source) {
      await queryInterface.addColumn('leads', 'source', {
        type: Sequelize.ENUM('call', 'whatsapp', 'message', 'chat'),
        allowNull: false,
        defaultValue: 'message',
      });
    }

    if (!tableInfo.status) {
      await queryInterface.addColumn('leads', 'status', {
        type: Sequelize.ENUM('new', 'contacted', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      });
    }

    if (!tableInfo.read_at) {
      await queryInterface.addColumn('leads', 'read_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // Add indexes if not present
    try {
      await queryInterface.addIndex('leads', ['seller_id', 'status'], {
        name: 'leads_seller_id_status',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('leads', ['car_id'], {
        name: 'leads_car_id',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('leads', ['buyer_id'], {
        name: 'leads_buyer_id',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('leads', ['created_at'], {
        name: 'leads_created_at',
      });
    } catch (e) {}
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('leads');

    if (tableInfo.contact_phone) {
      await queryInterface.removeColumn('leads', 'contact_phone');
    }
    if (tableInfo.preferred_contact) {
      await queryInterface.removeColumn('leads', 'preferred_contact');
    }
    if (tableInfo.source) {
      await queryInterface.removeColumn('leads', 'source');
    }
    if (tableInfo.status) {
      await queryInterface.removeColumn('leads', 'status');
    }
    if (tableInfo.read_at) {
      await queryInterface.removeColumn('leads', 'read_at');
    }
  },
};
