// scripts/seed-tamilnadu.js
// Run with: node scripts/seed-tamilnadu.js
const { State, District, City } = require('../src/models');
const sequelize = require('../src/config/database');

const tamilNaduData = {
  name: 'Tamil Nadu',
  code: 'TN',
  districts: [
    {
      name: 'Ariyalur',
      cities: ['Ariyalur', 'Jayankondam', 'Sendurai', 'Udayarpalayam'],
    },
    {
      name: 'Chengalpattu',
      cities: ['Chengalpattu', 'Madurantakam', 'Tambaram', 'Pallavaram', 'Kancheepuram'],
    },
    {
      name: 'Chennai',
      cities: ['Chennai', 'Ambattur', 'Avadi', 'Tiruvottiyur', 'Perungudi', 'Sholinganallur'],
    },
    {
      name: 'Coimbatore',
      cities: ['Coimbatore', 'Pollachi', 'Mettupalayam', 'Valparai', 'Kinathukadavu'],
    },
    {
      name: 'Cuddalore',
      cities: ['Cuddalore', 'Chidambaram', 'Virudhachalam', 'Panruti', 'Neyveli'],
    },
    {
      name: 'Dharmapuri',
      cities: ['Dharmapuri', 'Harur', 'Pappireddipatti', 'Palacode', 'Karimangalam'],
    },
    {
      name: 'Dindigul',
      cities: ['Dindigul', 'Palani', 'Kodaikanal', 'Oddanchatram', 'Natham', 'Vedasandur'],
    },
    {
      name: 'Erode',
      cities: ['Erode', 'Gobichettipalayam', 'Sathyamangalam', 'Perundurai', 'Bhavani', 'Kangeyam'],
    },
    {
      name: 'Kallakurichi',
      cities: ['Kallakurichi', 'Thirukkoyilur', 'Ulundurpettai', 'Sankarapuram'],
    },
    {
      name: 'Kancheepuram',
      cities: ['Kancheepuram', 'Sriperumbudur', 'Uthiramerur', 'Walajabad', 'Kundrathur'],
    },
    {
      name: 'Kanniyakumari',
      cities: ['Nagercoil', 'Kanniyakumari', 'Kulithurai', 'Padmanabhapuram', 'Thiruvattar'],
    },
    {
      name: 'Karur',
      cities: ['Karur', 'Aravakurichi', 'Kulithalai', 'Krishnarayapuram'],
    },
    {
      name: 'Krishnagiri',
      cities: ['Krishnagiri', 'Hosur', 'Denkanikottai', 'Uthangarai', 'Pochampalli'],
    },
    {
      name: 'Madurai',
      cities: ['Madurai', 'Melur', 'Thirumangalam', 'Usilampatti', 'Alanganallur'],
    },
    {
      name: 'Mayiladuthurai',
      cities: ['Mayiladuthurai', 'Sirkazhi', 'Vaitheeswarankoil', 'Tharangambadi'],
    },
    {
      name: 'Nagapattinam',
      cities: ['Nagapattinam', 'Vedaranyam', 'Sirkali', 'Thiruthuraipoondi'],
    },
    {
      name: 'Namakkal',
      cities: ['Namakkal', 'Tiruchengode', 'Rasipuram', 'Paramathi-Velur', 'Kolli Hills'],
    },
    {
      name: 'Nilgiris',
      cities: ['Udhagamandalam', 'Coonoor', 'Kotagiri', 'Gudalur', 'Wellington'],
    },
    {
      name: 'Perambalur',
      cities: ['Perambalur', 'Ariyalur', 'Kunnam', 'Veppanthattai'],
    },
    {
      name: 'Pudukkottai',
      cities: ['Pudukkottai', 'Aranthangi', 'Keeranur', 'Alangudi'],
    },
    {
      name: 'Ramanathapuram',
      cities: ['Ramanathapuram', 'Paramakudi', 'Rameswaram', 'Kilakarai', 'Mudukulathur'],
    },
    {
      name: 'Ranipet',
      cities: ['Ranipet', 'Walaja', 'Arakkonam', 'Sholinghur', 'Arcot'],
    },
    {
      name: 'Salem',
      cities: ['Salem', 'Mettur', 'Omalur', 'Attur', 'Edappadi', 'Sankagiri'],
    },
    {
      name: 'Sivaganga',
      cities: ['Sivaganga', 'Karaikudi', 'Devakottai', 'Thirupathur'],
    },
    {
      name: 'Tenkasi',
      cities: ['Tenkasi', 'Sankarankovil', 'Sivagiri', 'Sengottai', 'Kadayanallur'],
    },
    {
      name: 'Thanjavur',
      cities: ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Thiruvaiyaru', 'Orathanadu'],
    },
    {
      name: 'Theni',
      cities: ['Theni', 'Periyakulam', 'Bodinayakkanur', 'Uthamapalayam', 'Andipatti'],
    },
    {
      name: 'Thoothukkudi',
      cities: ['Thoothukkudi', 'Tiruchendur', 'Kovilpatti', 'Sattankulam', 'Ettaiyapuram'],
    },
    {
      name: 'Tiruchirappalli',
      cities: ['Tiruchirappalli', 'Srirangam', 'Manapparai', 'Thuraiyur', 'Lalgudi', 'Musiri'],
    },
    {
      name: 'Tirunelveli',
      cities: ['Tirunelveli', 'Ambasamudram', 'Tiruvengadam', 'Valliyur', 'Nanguneri'],
    },
    {
      name: 'Tirupathur',
      cities: ['Tirupathur', 'Vaniyambadi', 'Ambur', 'Nattrampalli', 'Jolarpet'],
    },
    {
      name: 'Tiruppur',
      cities: ['Tiruppur', 'Palladam', 'Udumalaipettai', 'Dharapuram', 'Avinashi'],
    },
    {
      name: 'Tiruvallur',
      cities: ['Tiruvallur', 'Poonamallee', 'Tiruttani', 'Pallipattu', 'Gummidipoondi'],
    },
    {
      name: 'Tiruvannamalai',
      cities: ['Tiruvannamalai', 'Arni', 'Vandavasi', 'Chengam', 'Polur'],
    },
    {
      name: 'Tiruvarur',
      cities: ['Tiruvarur', 'Mannargudi', 'Thiruthuraipoondi', 'Needamangalam'],
    },
    {
      name: 'Vellore',
      cities: ['Vellore', 'Katpadi', 'Gudiyatham', 'Pernambut', 'Sathuvachari'],
    },
    {
      name: 'Viluppuram',
      cities: ['Viluppuram', 'Tindivanam', 'Gingee', 'Vikravandi', 'Thiruvennainallur'],
    },
    {
      name: 'Virudhunagar',
      cities: ['Virudhunagar', 'Sivakasi', 'Rajapalayam', 'Aruppukkottai', 'Sattur'],
    },
  ],
};

async function seedTamilNadu() {
  try {
    // 1. Check if Tamil Nadu already exists to prevent re-seeding
    let state = await State.findOne({ where: { name: tamilNaduData.name }, logging: false });
    if (state) {
      const districtCount = await District.count({ where: { state_id: state.id }, logging: false });
      if (districtCount >= tamilNaduData.districts.length) {
        console.log(`✅ State: ${state.name} is already fully seeded. Exiting.`);
        return;
      }
      console.log(`⚠️  State: ${state.name} exists but may be missing districts. Proceeding to seed missing data...`);
    }

    const stateId = state ? state.id : require('crypto').randomUUID();
    const statesToInsert = state ? [] : [{ id: stateId, name: tamilNaduData.name, code: tamilNaduData.code }];
    
    const districtsToInsert = [];
    const citiesToInsert = [];

    // 2. Prepare all data in memory
    for (const districtData of tamilNaduData.districts) {
      const districtId = require('crypto').randomUUID();
      districtsToInsert.push({ id: districtId, name: districtData.name, state_id: stateId });

      for (const cityName of districtData.cities) {
        citiesToInsert.push({
          id: require('crypto').randomUUID(),
          name: cityName,
          district_id: districtId,
          state_id: stateId,
        });
      }
    }

    // 3. Execute blazing fast bulk inserts
    if (statesToInsert.length > 0) {
      await State.bulkCreate(statesToInsert, { ignoreDuplicates: true, logging: false });
    }
    
    if (districtsToInsert.length > 0) {
      await District.bulkCreate(districtsToInsert, { ignoreDuplicates: true, logging: false });
    }
    
    if (citiesToInsert.length > 0) {
      await City.bulkCreate(citiesToInsert, { ignoreDuplicates: true, logging: false });
    }

    console.log(`✅ Successfully seeded ${districtsToInsert.length} districts and ${citiesToInsert.length} cities for Tamil Nadu.`);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  }
}

// Run it
seedTamilNadu()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
