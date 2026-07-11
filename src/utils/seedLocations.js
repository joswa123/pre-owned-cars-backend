const { State, City } = require('../models');
const logger = require('./logger');

const statesData = [
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Kerala', code: 'KL' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Andhra Pradesh', code: 'AP' },
  { name: 'Telangana', code: 'TS' },
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Gujarat', code: 'GJ' },
  // ... add more as needed
];

const citiesData = {
  'Tamil Nadu': ['Coimbatore', 'Chennai', 'Madurai', 'Salem', 'Trichy', 'Erode'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru'],
  // ... add more
};

const seedLocations = async () => {
  try {
    // Check if states already exist
    const count = await State.count();
    if (count > 0) {
      logger.info('📍 Locations already seeded');
      return;
    }

    // Create states
    for (const stateData of statesData) {
      const state = await State.create(stateData);
      const cities = citiesData[stateData.name] || [];
      for (const cityName of cities) {
        await City.create({ state_id: state.id, name: cityName });
      }
    }
    logger.info('✅ Locations seeded successfully');
  } catch (error) {
    logger.error('❌ Failed to seed locations:', error);
  }
};

module.exports = seedLocations;