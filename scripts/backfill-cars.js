require('dotenv').config();
const sequelize = require('../src/config/database');
async function backfill() {
  try {
    const [results, metadata] = await sequelize.query(`
      UPDATE cars 
      SET state_id = (SELECT state_id FROM districts WHERE id = cars.district_id), 
          city_id = (SELECT id FROM cities WHERE district_id = cars.district_id LIMIT 1) 
      WHERE district_id IS NOT NULL 
        AND (state_id IS NULL OR city_id IS NULL);
    `);
    console.log(`✅ Backfill completed. Modified: ${metadata.affectedRows || 'unknown'} rows.`);
    
    // Clear Redis cache so new cars show up correctly
    const redisClient = require('../src/config/redis');
    await redisClient.connect();
    
    const keys = await redisClient.keys('cars:list:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    await redisClient.del('__express__/api/v1/cars__');
    console.log('✅ Cleared car cache.');
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error during backfill:', e);
    process.exit(1);
  }
}
backfill();
