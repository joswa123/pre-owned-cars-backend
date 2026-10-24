'use strict';

require('dotenv').config();
const sequelize = require('../src/config/database');
const { CarType } = require('../src/models');
const redisClient = require('../src/config/redis');

const CANONICAL_CAR_TYPES = [
  { name: 'Sedan', slug: 'sedan', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720191/sedan_pskci0.png', order: 1 },
  { name: 'SUV', slug: 'suv', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720105/SUV_utci1f.png', order: 2 },
  { name: 'Hatchback', slug: 'hatchback', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720145/hatchback_aye9d4.png', order: 3 },
  { name: 'MUV', slug: 'muv', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722308/muv.webp', order: 4 },
  { name: 'Coupe', slug: 'coupe', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720117/coupe_dzjsl3.png', order: 5 },
  { name: 'Convertible', slug: 'convertible', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720053/convertible_zuiut0.png', order: 6 },
  { name: 'Crossover', slug: 'crossover', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720132/crossover_udktne.png', order: 7 },
  { name: 'Pickup', slug: 'pickup', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720171/pickup_btpxyv.png', order: 8 },
  { name: 'Mini Van', slug: 'mini-van', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787720153/mini_van_t2wn6l.png', order: 9 },
  { name: 'Sports Car', slug: 'sports-car', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787723212/racing-car-side-view-silhouette-svgrepo-com_1_sur8g5.webp', order: 10 },
  { name: 'Estate', slug: 'estate', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787722588/estate.webp', order: 11 },
  { name: 'Notchback', slug: 'notchback', icon_url: 'https://res.cloudinary.com/fub1whjx/image/upload/v1787721301/notchback_ackoxm.webp', order: 12 },
];

async function restoreCarTypes() {
  await sequelize.authenticate();
  console.log('Connected to database:', sequelize.config.database);

  console.log('1. Clearing current car_types...');
  await sequelize.query('DELETE FROM car_types;');

  console.log('2. Inserting canonical car body types (Sedan, SUV, Hatchback, etc.)...');
  for (const item of CANONICAL_CAR_TYPES) {
    await CarType.create({
      name: item.name,
      slug: item.slug,
      icon_url: item.icon_url,
      order: item.order,
      is_active: true,
    });
    console.log(`   + Added ${item.name} (${item.slug})`);
  }

  // Clear Redis Cache
  try {
    if (redisClient && redisClient.isOpen) {
      const patterns = [
        '__express__/api/v1/car-types*',
        '__express__/api/car-types*',
        'car-types:v2:*',
        'public:car_types*',
      ];
      for (const p of patterns) {
        const keys = await redisClient.keys(p);
        if (keys && keys.length > 0) {
          await redisClient.del(keys);
        }
      }
      console.log('✅ Cleared Redis cache keys for car-types.');
    }
  } catch (err) {
    console.warn('Redis clear warning:', err.message);
  }

  const finalCount = await CarType.count();
  console.log(`\n🎉 Restore complete! ${finalCount} car types restored successfully.`);
  process.exit(0);
}

restoreCarTypes().catch((err) => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});
