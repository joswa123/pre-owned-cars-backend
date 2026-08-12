require('dotenv').config({ override: true });
const sequelize = require('../src/config/database');
const { Car, User } = require('../src/models');
const { Op } = require('sequelize');

async function backfillCarLocations() {
  const transaction = await sequelize.transaction();
  try {
    const carsToUpdate = await Car.findAll({
      where: {
        user_id: { [Op.ne]: null },
        [Op.or]: [
          { state_id: null },
          { district_id: null },
          { city_id: null }
        ]
      },
      include: [
        { model: User, as: 'seller', attributes: ['id', 'state_id', 'district_id', 'city_id'] }
      ],
      transaction
    });

    console.log(`🔍 Found ${carsToUpdate.length} cars with missing location fields.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const car of carsToUpdate) {
      const seller = car.seller;
      if (seller && (seller.state_id || seller.district_id || seller.city_id)) {
        await car.update({
          state_id: car.state_id || seller.state_id,
          district_id: car.district_id || seller.district_id,
          city_id: car.city_id || seller.city_id
        }, { transaction });
        updatedCount++;
        console.log(`✅ Backfilled location for Car ${car.id} from Seller ${seller.id}`);
      } else {
        skippedCount++;
        console.log(`⚠️ User ${car.user_id} has no location – skipping car ${car.id}`);
      }
    }

    await transaction.commit();
    console.log(`🎉 Location backfill completed! Updated: ${updatedCount}, Skipped: ${skippedCount}`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Location backfill failed:', error);
  } finally {
    process.exit(0);
  }
}

backfillCarLocations();
