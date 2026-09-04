// scripts/seed-locations-from-package.js
// Run with: node scripts/seed-locations-from-package.js

const { State, District, City } = require('../src/models');
const sequelize = require('../src/config/database');

/**
 * Standard Indian State/UT 2-letter codes (ISO 3166-2:IN & Motor Vehicle RTO codes)
 */
const STATE_CODES = {
  'Andaman and Nicobar Islands': 'AN',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chandigarh': 'CH',
  'Chhattisgarh': 'CG',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  'Delhi': 'DL',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Ladakh': 'LA',
  'Lakshadweep': 'LD',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'Nagaland': 'NL',
  'Odisha': 'OD',
  'Puducherry': 'PY',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TS',
  'Tripura': 'TR',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB',
};

/**
 * Helper to get or generate state code
 */
function getStateCode(stateName) {
  if (STATE_CODES[stateName]) return STATE_CODES[stateName];

  // Case-insensitive lookup
  const match = Object.entries(STATE_CODES).find(
    ([k]) => k.toLowerCase() === stateName.toLowerCase()
  );
  if (match) return match[1];

  // Fallback: 2-3 uppercase letters abbreviation
  const words = stateName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return stateName.substring(0, 3).toUpperCase();
}

async function seedLocations() {
  console.log('⏳ Connecting to database...');
  await sequelize.authenticate();
  console.log('✅ Connected to database.');

  console.log('⏳ Loading location data from npm package "indian-states-cities-geolocation"...');
  const { getAllStates, getCitiesByState } = await import('indian-states-cities-geolocation');

  const states = getAllStates();
  console.log(`📋 Found ${states.length} states/UTs in dataset.\n`);

  const transaction = await sequelize.transaction();

  let statesCreatedCount = 0;
  let statesExistingCount = 0;
  let districtsCreatedCount = 0;
  let districtsExistingCount = 0;

  try {
    for (let i = 0; i < states.length; i++) {
      const stateName = states[i];
      const stateCode = getStateCode(stateName);

      // 1. Find or create state
      const [state, stateCreated] = await State.findOrCreate({
        where: { name: stateName },
        defaults: {
          name: stateName,
          code: stateCode,
        },
        transaction,
      });

      if (stateCreated) {
        statesCreatedCount++;
      } else {
        statesExistingCount++;
        // If state code was missing/null, backfill it
        if (!state.code && stateCode) {
          await state.update({ code: stateCode }, { transaction });
        }
      }

      // 2. Fetch districts for the state (note: package's getCitiesByState returns districts with lat/lng)
      const districts = getCitiesByState(stateName) || [];
      let stateDistrictsCreated = 0;

      for (const dist of districts) {
        const districtName = typeof dist === 'string' ? dist : dist.name;
        if (!districtName) continue;

        const [, distCreated] = await District.findOrCreate({
          where: {
            name: districtName,
            state_id: state.id,
          },
          defaults: {
            name: districtName,
            state_id: state.id,
          },
          transaction,
        });

        if (distCreated) {
          districtsCreatedCount++;
          stateDistrictsCreated++;
        } else {
          districtsExistingCount++;
        }
      }

      console.log(
        `📍 [${i + 1}/${states.length}] ${stateName} (${stateCode}): ${districts.length} districts processed (+${stateDistrictsCreated} new)`
      );
    }

    await transaction.commit();

    console.log('\n========================================');
    console.log('✅ Location data seeded successfully!');
    console.log('========================================');
    console.log(`📊 States:    ${statesCreatedCount} created, ${statesExistingCount} already existed (Total: ${states.length})`);
    console.log(`📊 Districts: ${districtsCreatedCount} created, ${districtsExistingCount} already existed (Total: ${districtsCreatedCount + districtsExistingCount})`);
    console.log('========================================\n');
  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Seeding failed, transaction rolled back:', error);
    throw error;
  }
}

seedLocations()
  .then(() => {
    console.log('🏁 Process completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Fatal error during seeding:', err);
    process.exit(1);
  });
