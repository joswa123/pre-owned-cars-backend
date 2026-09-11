require('dotenv').config();
const { User, Requirement, Car, Brand, Model } = require('../src/models');
const requirementMatchingService = require('../src/services/requirementMatchingService');

async function testMatching() {
  try {
    // 1. Get two different users
    const users = await User.findAll({ limit: 2 });
    if (users.length < 2) {
      console.log('Need at least 2 users to test matching.');
      process.exit(1);
    }
    const userA = users[0];
    const userB = users[1];

    // 2. Get a brand and model
    const brand = await Brand.findOne();
    const model = await Model.findOne({ where: { brand_id: brand.id } });

    if (!brand || !model) {
      console.log('Need at least 1 brand and model in the database.');
      process.exit(1);
    }

    // 3. Create a requirement for userA
    const requirement = await Requirement.create({
      user_id: userA.id,
      brand_id: brand.id,
      model_id: model.id,
      body_type: 'Any',
      transmission: 'Any',
      board_type: 'Any',
      purchase_plan_days: 30,
      status: 'active',
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
    console.log(`Created Requirement ID: ${requirement.id} for User A (${userA.id})`);

    // 2b. Get a variant
    const variant = await require('../src/models').Variant.findOne();
    if (!variant) {
      console.log('Need at least 1 variant in the database.');
      process.exit(1);
    }

    // 4. Create a matching car for userB
    const car = await Car.create({
      user_id: userB.id,
      brand_id: brand.id,
      model_id: model.id,
      variant_id: variant.id,
      year: 2020,
      price: 500000,
      km_driven: 20000,
      body_type: 'Sedan',
      transmission: 'Manual',
      board_type: 'Own Board',
      ownership: '1st Owner',
      posted_by_type: 'customer',
      status: 'active'
    });
    console.log(`Created Car ID: ${car.id} for User B (${userB.id})`);

    // 5. Call matchRequirementsForCar
    console.log('Running matchRequirementsForCar...');
    await requirementMatchingService.matchRequirementsForCar(car.id);
    console.log('Matching complete.');

    // 6. Verify notification was created
    const { Notification } = require('../src/models');
    const notification = await Notification.findOne({
      where: {
        user_id: userA.id,
        requirement_id: requirement.id,
        car_id: car.id
      }
    });

    if (notification) {
      console.log('Success! Notification was created in the database:');
      console.log(notification.toJSON());
    } else {
      console.log('Failure! Notification was NOT created.');
    }

  } catch (error) {
    console.error('Error testing matching:', error);
  } finally {
    process.exit(0);
  }
}

testMatching();
