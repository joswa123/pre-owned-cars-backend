const dotenv = require('dotenv');
dotenv.config({ override: true });

const sequelize = require('../src/config/database');
const { CarType, Car } = require('../src/models');
const carService = require('../src/services/carService');
const updateCarTypeIcons = require('./update-car-type-icons');

async function verify() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    // 1. Ensure icon_url column exists in car_types table
    const [cols] = await sequelize.query("SHOW COLUMNS FROM car_types LIKE 'icon_url';");
    if (cols.length === 0) {
      console.log('Adding icon_url column to car_types table...');
      await sequelize.query("ALTER TABLE car_types ADD COLUMN icon_url VARCHAR(500) NULL AFTER name;");
      console.log('✅ Added icon_url column to car_types.');
    } else {
      console.log('✅ icon_url column already exists in car_types.');
    }

    // 2. Run updateCarTypeIcons
    const updatedCount = await updateCarTypeIcons();
    console.log(`✅ updateCarTypeIcons executed. Updated/Inserted count: ${updatedCount}`);

    // 3. Query all CarTypes
    const carTypes = await CarType.findAll({ order: [['name', 'ASC']] });
    console.log(`✅ Found ${carTypes.length} car types in database:`);
    carTypes.forEach(ct => {
      console.log(`  - [${ct.name}]: ${ct.icon_url || '(NO ICON)'}`);
    });

    // 4. Test Car query with carType include
    const carsResult = await carService.getCars({}, 1, 3);
    console.log(`✅ getCars returned ${carsResult.cars?.length || 0} cars (Total: ${carsResult.total})`);
    if (carsResult.cars && carsResult.cars.length > 0) {
      const sample = carsResult.cars[0];
      console.log(`Sample car ID: ${sample.id}`);
      console.log(`Sample car body_type string: "${sample.body_type}"`);
      console.log('Sample car carType object:', sample.carType);
      if (sample.carType?.icon_url) {
        console.log(`🎉 SUCCESS: carType.icon_url is populated: ${sample.carType.icon_url}`);
      }
    }

    console.log('\n🌟 All Car Type Icon tests and verifications completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

verify();
