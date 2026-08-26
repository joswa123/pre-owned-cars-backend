const dotenv = require('dotenv');
dotenv.config({ override: true });

const sequelize = require('../src/config/database');
const { CarType } = require('../src/models');
const logger = require('../src/utils/logger');

const CAR_TYPE_ICONS = [
  { name: 'convertible', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720053/convertible_zuiut0.png' },
  { name: 'suv', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720105/SUV_utci1f.png' },
  { name: 'coupe', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720117/coupe_dzjsl3.png' },
  { name: 'crossover', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720132/crossover_udktne.png' },
  { name: 'hatchback', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720145/hatchback_aye9d4.png' },
  { name: 'mini_van', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png' },
  { name: 'pickup', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720171/pickup_btpxyv.png' },
  { name: 'sports_sedan', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720582/17709cebb171220991dcca357d428727_ghcvxp.webp' },
  { name: 'notchback', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787721301/notchback_ackoxm.webp' },
  { name: 'muv', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722308/muv.webp' },
  { name: 'estate', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722588/estate.webp' },
  { name: 'sedan', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720191/sedan_pskci0.png' },
  { name: 'sports_car', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787723212/racing-car-side-view-silhouette-svgrepo-com_1_sur8g5.webp' },
];

const ALIAS_MAP = {
  'Convertible': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720053/convertible_zuiut0.png',
  'SUV': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720105/SUV_utci1f.png',
  'Coupe': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720117/coupe_dzjsl3.png',
  'Crossover': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720132/crossover_udktne.png',
  'Hatchback': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720145/hatchback_aye9d4.png',
  'Mini Van': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png',
  'Van Minivan': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png',
  'Pickup': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720171/pickup_btpxyv.png',
  'Sports Sedan': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720582/17709cebb171220991dcca357d428727_ghcvxp.webp',
  'Sports sedan': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720582/17709cebb171220991dcca357d428727_ghcvxp.webp',
  'Notchback': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787721301/notchback_ackoxm.webp',
  'MUV': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722308/muv.webp',
  'Estate': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722588/estate.webp',
  'Wagon': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722588/estate.webp',
  'Sedan': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720191/sedan_pskci0.png',
  'Sports Car': 'https://res.cloudinary.com/fub1whjx/image/upload/v1787723212/racing-car-side-view-silhouette-svgrepo-com_1_sur8g5.webp',
};

async function updateCarTypeIcons() {
  try {
    await sequelize.authenticate();
    logger.info('Connected to database. Updating car type icon URLs...');

    // 0. Ensure icon_url column exists in car_types table
    const [cols] = await sequelize.query("SHOW COLUMNS FROM car_types LIKE 'icon_url';");
    if (cols.length === 0) {
      logger.info('Adding icon_url column to car_types table...');
      await sequelize.query("ALTER TABLE car_types ADD COLUMN icon_url VARCHAR(500) NULL AFTER name;");
      logger.info('✅ Added icon_url column to car_types.');
    }

    // 1. Update all existing rows in car_types
    const allTypes = await CarType.findAll();
    let updatedCount = 0;

    for (const carType of allTypes) {
      const nameKey = carType.name;
      const lowerKey = nameKey.toLowerCase();
      const snakeKey = lowerKey.replace(/[\s-]+/g, '_');

      const iconMatch = ALIAS_MAP[nameKey]
        || CAR_TYPE_ICONS.find(c => c.name === lowerKey || c.name === snakeKey)?.icon_url;

      if (iconMatch && carType.icon_url !== iconMatch) {
        await carType.update({ icon_url: iconMatch });
        updatedCount++;
      }
    }

    // 2. Ensure all 13 canonical names and display aliases exist with icons
    for (const item of CAR_TYPE_ICONS) {
      const existing = await CarType.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('name')),
          item.name.toLowerCase()
        ),
      });

      if (!existing) {
        await CarType.create({
          name: item.name,
          icon_url: item.icon_url,
        });
        updatedCount++;
      } else if (!existing.icon_url) {
        await existing.update({ icon_url: item.icon_url });
        updatedCount++;
      }
    }

    // Also update common casing versions like Sedan, SUV, etc.
    for (const [name, icon_url] of Object.entries(ALIAS_MAP)) {
      const existing = await CarType.findOne({ where: { name } });
      if (existing && !existing.icon_url) {
        await existing.update({ icon_url });
        updatedCount++;
      } else if (!existing) {
        await CarType.create({ name, icon_url });
        updatedCount++;
      }
    }

    logger.info(`✅ Car type icons updated successfully. Updated/Inserted count: ${updatedCount}`);
    return updatedCount;
  } catch (error) {
    logger.error(`❌ Failed to update car type icons: ${error.message}`);
    throw error;
  }
}

if (require.main === module) {
  updateCarTypeIcons()
    .then(() => {
      console.log('Update finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Update failed:', err);
      process.exit(1);
    });
}

module.exports = updateCarTypeIcons;
