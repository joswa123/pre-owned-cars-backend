const dotenv = require('dotenv');
dotenv.config();

const sequelize = require('../src/config/database');
const { CarType } = require('../src/models');
const redisClient = require('../src/config/redis');

async function resetCategories() {
  await sequelize.authenticate();
  console.log('Connected to DB:', process.env.DB_NAME);

  // 1. Delete all existing records from car_types
  const countBefore = await CarType.count();
  console.log(`Found ${countBefore} existing categories in car_types.`);

  await sequelize.query('DELETE FROM car_types;');
  console.log('✅ Cleared all existing categories from car_types table.');

  // 2. Invalidate all Redis cache keys for categories
  try {
    if (redisClient && !redisClient.isOpen) {
      await redisClient.connect().catch(() => {});
    }
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
      console.log('✅ Flushed all category Redis cache keys.');
    }
  } catch (err) {
    console.warn('Redis flush warning:', err.message);
  }

  console.log('🎉 Category data reset complete. Table is now clean and available for new categories (Truck, Bikes, etc.)!');
  process.exit(0);
}

resetCategories().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
