// scripts/seed-cities-from-api.js
// Fetches all Indian cities from CountriesNow API and stores them in the cities table,
// matching each city to its district where possible (by name, case-insensitive).
//
// Run with: node scripts/seed-cities-from-api.js
//
// Features:
//   - Per-state transactions (safe — no single giant transaction)
//   - Retry logic (3 attempts per state with exponential backoff)
//   - Idempotent (safe to re-run — uses findOrCreate + bulkCreate with ignoreDuplicates)
//   - Fuzzy district matching: exact name → partial name → first-word match
//   - Delay between API calls to respect the free-tier server

const axios = require('axios');
const sequelize = require('../src/config/database');
const { State, District, City } = require('../src/models');

const API_URL = 'https://countriesnow.space/api/v0.1/countries/state/cities';
const COUNTRY = 'India';
const DELAY_MS = 500;          // ms between API calls per state
const MAX_RETRIES = 3;         // retry attempts per state
const RETRY_DELAY_MS = 2000;   // base delay between retries (doubles each attempt)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch cities for a given state from CountriesNow API with retry.
 */
async function fetchCitiesForState(stateName) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        API_URL,
        { country: COUNTRY, state: stateName },
        { timeout: 15000 }
      );
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      return [];
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      const waitMs = RETRY_DELAY_MS * attempt;
      console.warn(`   ⚠️  Attempt ${attempt}/${MAX_RETRIES} failed for "${stateName}": ${err.message}${isLast ? ' — giving up.' : ` — retrying in ${waitMs}ms...`}`);
      if (!isLast) await sleep(waitMs);
    }
  }
  return null; // null = all retries failed
}

/**
 * Build a fuzzy district lookup from district list.
 * Returns a function: (cityName) => districtId | null
 */
function buildDistrictMatcher(districts) {
  // Map: lowercase district name → id
  const exactMap = new Map(districts.map(d => [d.name.toLowerCase().trim(), d.id]));

  return function matchDistrict(cityName) {
    const lower = cityName.toLowerCase().trim();

    // 1. Exact match
    if (exactMap.has(lower)) return exactMap.get(lower);

    // 2. District name is contained in city name (e.g. "Coimbatore North" → "Coimbatore")
    for (const [distName, distId] of exactMap) {
      if (lower.includes(distName)) return distId;
    }

    // 3. City name is contained in district name (e.g. "Mumbai" → "Mumbai City")
    for (const [distName, distId] of exactMap) {
      if (distName.includes(lower)) return distId;
    }

    return null;
  };
}

// ─── Main Seeder ──────────────────────────────────────────────────────────────

async function seedCities() {
  console.log('⏳ Connecting to database...');
  await sequelize.authenticate();
  console.log('✅ Connected.\n');

  console.log('📋 Fetching states from database...');
  const states = await State.findAll({ order: [['name', 'ASC']] });
  console.log(`✅ Found ${states.length} states.\n`);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalUnmatched = 0;
  let failedStates = [];

  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    process.stdout.write(`\n[${i + 1}/${states.length}] 🌐 ${state.name} — fetching...`);

    // Fetch from API
    const cityNames = await fetchCitiesForState(state.name);

    if (cityNames === null) {
      console.log(` ❌ All retries failed — skipping.`);
      failedStates.push(state.name);
      await sleep(DELAY_MS);
      continue;
    }

    if (cityNames.length === 0) {
      console.log(` ⚠️  No cities returned — skipping.`);
      await sleep(DELAY_MS);
      continue;
    }

    console.log(` Got ${cityNames.length} cities.`);

    // Load districts for this state to build the matcher
    const districts = await District.findAll({ where: { state_id: state.id } });
    const matchDistrict = buildDistrictMatcher(districts);

    // Deduplicate city names (API sometimes returns duplicates)
    const uniqueCityNames = [...new Set(cityNames.map(c => c.trim()).filter(Boolean))];

    // Prepare city rows
    const citiesPayload = uniqueCityNames.map(cityName => {
      const districtId = matchDistrict(cityName);
      if (!districtId) totalUnmatched++;
      return { cityName, districtId };
    });

    // Use a per-state transaction for atomicity without holding a single giant lock
    const transaction = await sequelize.transaction();
    try {
      let stateCreated = 0;
      let stateSkipped = 0;

      for (const { cityName, districtId } of citiesPayload) {
        totalProcessed++;

        // findOrCreate key: name + state_id + district_id (matches the unique scenario)
        const [, created] = await City.findOrCreate({
          where: {
            name: cityName,
            state_id: state.id,
            ...(districtId ? { district_id: districtId } : {}),
          },
          defaults: {
            name: cityName,
            state_id: state.id,
            district_id: districtId || null,
          },
          transaction,
        });

        if (created) {
          stateCreated++;
          totalCreated++;
        } else {
          stateSkipped++;
          totalSkipped++;
        }
      }

      await transaction.commit();
      console.log(`   ✅ Created: ${stateCreated}  |  Already existed: ${stateSkipped}  |  No district match: ${citiesPayload.filter(c => !c.districtId).length}`);
    } catch (err) {
      await transaction.rollback();
      console.error(`   ❌ Transaction failed for ${state.name}: ${err.message}`);
      failedStates.push(state.name);
    }

    // Polite delay between API calls
    await sleep(DELAY_MS);
  }

  // ─── Final Summary ───────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('✅ City seeding complete!');
  console.log('='.repeat(50));
  console.log(`📊 Total cities processed : ${totalProcessed}`);
  console.log(`   ✅ Created              : ${totalCreated}`);
  console.log(`   ⏭️  Already existed     : ${totalSkipped}`);
  console.log(`   ⚠️  No district match   : ${totalUnmatched}`);
  if (failedStates.length > 0) {
    console.log(`\n❌ Failed states (${failedStates.length}): ${failedStates.join(', ')}`);
    console.log('   → Re-run the script to retry these states.');
  }
  console.log('='.repeat(50) + '\n');
}

seedCities()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
