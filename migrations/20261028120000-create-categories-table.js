'use strict';

const crypto = require('crypto');

const INITIAL_CATEGORIES = [
  {
    id: '29328b7c-9c60-407d-a8b7-0fd4fabc3214',
    name: 'Car',
    slug: 'car',
    icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1792757016/autodeal4u/categories/category-e8ec7c02-8b6a-4199-84bf-882795b18359.jpg',
    image_public_id: 'autodeal4u/categories/category-e8ec7c02-8b6a-4199-84bf-882795b18359',
    order: 1,
    is_active: true,
  },
  {
    id: '4420bf14-2c03-4a00-a4c3-8d7b61966a99',
    name: 'Bike',
    slug: 'bike',
    icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1792757065/autodeal4u/categories/category-9dcda38a-5064-4806-a8f4-eda915944d32.jpg',
    image_public_id: 'autodeal4u/categories/category-9dcda38a-5064-4806-a8f4-eda915944d32',
    order: 2,
    is_active: true,
  },
  {
    id: 'f00eeed6-bccb-448f-a1a5-4979681f0317',
    name: 'Scooty',
    slug: 'scooty',
    icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1792756963/autodeal4u/categories/category-5c4073a9-041c-44d1-a410-cd1491e99c0f.jpg',
    image_public_id: 'autodeal4u/categories/category-5c4073a9-041c-44d1-a410-cd1491e99c0f',
    order: 3,
    is_active: true,
  },
  {
    id: 'c72aa0fb-8a58-4c53-a3d8-05b5dd231d77',
    name: 'Commercial',
    slug: 'commercial',
    icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1792756367/autodeal4u/categories/category-58189484-bcf3-4424-9744-9320fb1e5c6f.jpg',
    image_public_id: 'autodeal4u/categories/category-58189484-bcf3-4424-9744-9320fb1e5c6f',
    order: 4,
    is_active: true,
  },
  {
    id: 'a1ab92ad-4d8b-4858-9f88-834114a737be',
    name: 'Spare parts',
    slug: 'spare-parts',
    icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1792756407/autodeal4u/categories/category-41caa88f-e40a-4486-9756-64c9dd3b5752.jpg',
    image_public_id: 'autodeal4u/categories/category-41caa88f-e40a-4486-9756-64c9dd3b5752',
    order: 5,
    is_active: true,
  },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.includes('categories');

    if (!tableExists) {
      await queryInterface.createTable('categories', {
        id: {
          type: Sequelize.CHAR(36),
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(50),
          allowNull: false,
          unique: true,
        },
        slug: {
          type: Sequelize.STRING(70),
          allowNull: false,
          unique: true,
        },
        icon_url: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        image_public_id: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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

      await queryInterface.addIndex('categories', ['slug'], {
        unique: true,
        name: 'idx_categories_slug',
      });

      await queryInterface.addIndex('categories', ['order'], {
        name: 'idx_categories_order',
      });
    }

    // Insert initial categories if table is empty
    const [rows] = await queryInterface.sequelize.query('SELECT COUNT(*) as count FROM categories');
    const count = rows && rows[0] ? (rows[0].count || rows[0]['COUNT(*)'] || 0) : 0;

    if (parseInt(count, 10) === 0) {
      const now = new Date();
      const records = INITIAL_CATEGORIES.map((cat) => ({
        ...cat,
        created_at: now,
        updated_at: now,
      }));
      await queryInterface.bulkInsert('categories', records);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('categories');
  },
};
