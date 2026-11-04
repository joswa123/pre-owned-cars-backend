const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { extractPublicIdFromUrl } = require('../utils/cloudinaryHelper');

const CommercialVehicleImage = sequelize.define('CommercialVehicleImage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  commercial_vehicle_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'commercial_vehicles', key: 'id' },
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
  tableName: 'commercial_vehicle_images',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['commercial_vehicle_id'] },
    { fields: ['commercial_vehicle_id', 'sort_order'] },
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

module.exports = CommercialVehicleImage;
