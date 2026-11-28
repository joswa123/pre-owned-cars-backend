const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { extractPublicIdFromUrl } = require('../utils/cloudinaryHelper');

const BikeImage = sequelize.define('BikeImage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bike_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'bikes', key: 'id' },
    onDelete: 'CASCADE',
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  public_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'bike_images',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['bike_id'] },
    { fields: ['bike_id', 'sort_order'] },
  ],
  hooks: {
    beforeCreate: (instance) => {
      if (instance.image_url && !instance.public_id && extractPublicIdFromUrl) {
        instance.public_id = extractPublicIdFromUrl(instance.image_url);
      }
    },
    beforeUpdate: (instance) => {
      if (instance.image_url && !instance.public_id && extractPublicIdFromUrl) {
        instance.public_id = extractPublicIdFromUrl(instance.image_url);
      }
    },
  },
});

module.exports = BikeImage;
