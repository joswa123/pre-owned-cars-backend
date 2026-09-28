const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { extractPublicIdFromUrl } = require('../utils/cloudinaryHelper');

/**
 * CarImage Model
 * Stores Cloudinary secure URLs and public IDs for car media images.
 * Enforces strictly that no local filesystem paths or non-Cloudinary URLs are stored.
 */
const CarImage = sequelize.define('CarImage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  car_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'cars', key: 'id' },
    onDelete: 'CASCADE',
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isCloudinary(value) {
        if (value !== null && value !== undefined && value !== '') {
          if (typeof value !== 'string' || !value.startsWith('https://res.cloudinary.com/')) {
            throw new Error('Image URL must start with https://res.cloudinary.com/');
          }
        }
      },
    },
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  public_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'car_images',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeValidate: (instance) => {
      if (instance.image_url) {
        if (typeof instance.image_url !== 'string' || !instance.image_url.startsWith('https://res.cloudinary.com/')) {
          throw new Error(`Invalid image URL: "${instance.image_url}". Image URL must start with https://res.cloudinary.com/`);
        }
      }
    },
    beforeCreate: (instance) => {
      if (instance.image_url) {
        if (!instance.image_url.startsWith('https://res.cloudinary.com/')) {
          throw new Error(`Invalid image URL: "${instance.image_url}". Image URL must start with https://res.cloudinary.com/`);
        }
        if (!instance.public_id) {
          instance.public_id = extractPublicIdFromUrl(instance.image_url);
        }
      }
    },
    beforeUpdate: (instance) => {
      if (instance.image_url) {
        if (!instance.image_url.startsWith('https://res.cloudinary.com/')) {
          throw new Error(`Invalid image URL: "${instance.image_url}". Image URL must start with https://res.cloudinary.com/`);
        }
        if (!instance.public_id) {
          instance.public_id = extractPublicIdFromUrl(instance.image_url);
        }
      }
    },
    beforeBulkCreate: (instances) => {
      for (const instance of instances) {
        if (instance.image_url) {
          if (!instance.image_url.startsWith('https://res.cloudinary.com/')) {
            throw new Error(`Invalid image URL: "${instance.image_url}". Image URL must start with https://res.cloudinary.com/`);
          }
          if (!instance.public_id) {
            instance.public_id = extractPublicIdFromUrl(instance.image_url);
          }
        }
      }
    },
  },
});

module.exports = CarImage;