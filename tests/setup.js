jest.setTimeout(30000);

const sequelize = require('../src/config/database');
const {
  User,
  CustomerProfile,
  DealerProfile,
  Otp,
  RefreshToken,
  Car,
  CarImage,
  Wishlist,
  Lead,
  Subscription,
  State,
  District,
  City,
} = require('../src/models');

const seedLocations = async () => {
  const [state] = await State.findOrCreate({
    where: { name: 'Tamil Nadu' },
    defaults: { name: 'Tamil Nadu', code: 'TN' },
  });

  const [district] = await District.findOrCreate({
    where: { name: 'Coimbatore', state_id: state.id },
    defaults: { name: 'Coimbatore', state_id: state.id },
  });

  await City.findOrCreate({
    where: { name: 'Gandhipuram', state_id: state.id },
    defaults: { name: 'Gandhipuram', state_id: state.id, district_id: district.id },
  });
};

beforeAll(async () => {
  await sequelize.authenticate();
  await seedLocations();
});

beforeEach(async () => {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const modelsToClean = [
    User,
    CustomerProfile,
    DealerProfile,
    Otp,
    RefreshToken,
    Car,
    CarImage,
    Wishlist,
    Lead,
    Subscription,
  ];
  for (const model of modelsToClean) {
    if (model) {
      await model.destroy({ where: {}, force: true });
    }
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
});

afterAll(async () => {
  await sequelize.close();
});