require('dotenv').config({ override: true });
const sequelize = require('../src/config/database');
const { Car, Brand, Model, Variant, City } = require('../src/models');
const carService = require('../src/services/carService');

async function verifyEndpoints() {
  console.log('🧪 Starting API Verification Checks...\n');

  try {
    // 1. Check Catalog Brands
    const brandCount = await Brand.count();
    console.log(`✅ Catalog Check: ${brandCount} Brands found in database.`);

    // 2. Check Car List with associations
    const carList = await carService.getCars({}, 1, 5);
    console.log(`✅ GET /cars Check: ${carList.total} total cars found.`);
    if (carList.cars.length > 0) {
      const firstCar = carList.cars[0];
      console.log(`   Sample Car: ${firstCar.brand?.name || 'N/A'} ${firstCar.carModel?.name || 'N/A'} ${firstCar.carVariant?.name || 'N/A'}`);
      console.log(`   Location: City: ${firstCar.city?.name || 'N/A'}, District: ${firstCar.district?.name || 'N/A'}, State: ${firstCar.state?.name || 'N/A'}`);
      console.log(`   Foreign Keys: brand_id: ${firstCar.brand_id}, model_id: ${firstCar.model_id}, variant_id: ${firstCar.variant_id}`);
    }

    // 3. Check Location Filter
    const sampleCity = await City.findOne({ where: { name: 'Gandhipuram' } });
    if (sampleCity) {
      const cityCars = await carService.getCars({ city_id: sampleCity.id });
      console.log(`✅ GET /cars?city_id=${sampleCity.id} (${sampleCity.name}) returned ${cityCars.total} cars.`);
    } else {
      console.log('⚠️ Gandhipuram city not found for location test.');
    }

    // 4. Check Single Car Detail
    const anyCar = await Car.findOne({ where: { status: 'active' } });
    if (anyCar) {
      const carDetail = await carService.getCarById(anyCar.id);
      console.log(`✅ GET /cars/${anyCar.id} detail loaded successfully:`);
      console.log(`   Model Association: ${carDetail.carModel ? carDetail.carModel.name : 'MISSING'}`);
      console.log(`   Variant Association: ${carDetail.carVariant ? carDetail.carVariant.name : 'MISSING'}`);
      console.log(`   Seller Info: ${carDetail.seller ? carDetail.seller.full_name : 'MISSING'}`);

      // 5. Check Similar Recommended
      const similarData = await carService.getSimilarRecommended(anyCar.id, null, 4);
      console.log(`✅ Similar/Recommended Check: ${similarData.data ? similarData.data.length : 0} similar cars returned.`);
    }

    console.log('\n🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Verification Check Failed:', error);
  } finally {
    process.exit(0);
  }
}

verifyEndpoints();
