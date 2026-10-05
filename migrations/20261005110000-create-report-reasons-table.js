'use strict';

const crypto = require('crypto');

const INITIAL_REASONS = [
  { label: 'Car Sold Out', value: 'car_sold_out', sort_order: 0, description: 'Car is no longer available/sold' },
  { label: 'Overpriced Car', value: 'overpriced_car', sort_order: 1, description: 'Price is significantly higher than market valuation' },
  { label: 'Incorrect car information', value: 'incorrect_info', sort_order: 2, description: 'Listing specifications, model, year, or photos are inaccurate' },
  { label: 'Seller Not Contactable', value: 'seller_not_contactable', sort_order: 3, description: 'Seller phone number is switched off or unresponsive' },
  { label: 'Dealer/Broker listed as an individual', value: 'dealer_listed_as_individual', sort_order: 4, description: 'Commercial dealer pretending to be an individual private seller' },
  { label: 'Fraudulent listing (Fake seller/car)', value: 'fraudulent_listing', sort_order: 5, description: 'Suspected scam, fake seller identity, or stolen images' },
  { label: 'Requesting money before seeing the car', value: 'requesting_money_before_seeing', sort_order: 6, description: 'Seller demands advance booking amount before vehicle inspection' },
  { label: 'Other', value: 'other', sort_order: 7, description: 'Any other issue not covered by standard categories' },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('report_reasons', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('report_reasons', ['is_active', 'sort_order'], {
      name: 'idx_report_reasons_active_sort',
    });

    const now = new Date();
    const records = INITIAL_REASONS.map((item) => ({
      id: crypto.randomUUID(),
      label: item.label,
      value: item.value,
      is_active: true,
      sort_order: item.sort_order,
      description: item.description,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('report_reasons', records);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('report_reasons');
  },
};
