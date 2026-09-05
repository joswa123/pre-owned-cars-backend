// scripts/seed-tamilnadu-cities.js
// Run with: node scripts/seed-tamilnadu-cities.js

require('dotenv').config();
const { State, District, City } = require('../src/models');
const sequelize = require('../src/config/database');
const redisClient = require('../src/config/redis');
const { fn, col, where: seqWhere, Op } = require('sequelize');

/**
 * Complete and Curated Tamil Nadu Dataset (All 38 Districts and Major Cities/Towns)
 */
const tamilNaduData = {
  stateName: 'Tamil Nadu',
  stateCode: 'TN',
  districts: [
    {
      name: 'Ariyalur',
      aliases: ['Ariyalur'],
      cities: ['Ariyalur', 'Jayankondam', 'Sendurai', 'Udayarpalayam', 'Andimadam'],
    },
    {
      name: 'Chengalpattu',
      aliases: ['Chengalpattu', 'Chengalpet'],
      cities: [
        'Chengalpattu',
        'Tambaram',
        'Pallavaram',
        'Chromepet',
        'Madurantakam',
        'Maraimalai Nagar',
        'Guduvanchery',
        'Mahabalipuram',
        'Kelambakkam',
        'Thiruporur',
        'Cheyyur',
        'Vandalur',
      ],
    },
    {
      name: 'Chennai',
      aliases: ['Chennai', 'Madras'],
      cities: [
        'Chennai',
        'T Nagar',
        'Anna Nagar',
        'Adyar',
        'Velachery',
        'Guindy',
        'Mylapore',
        'Ambattur',
        'Avadi',
        'Tiruvottiyur',
        'Perungudi',
        'Sholinganallur',
        'Royapettah',
        'Kilpauk',
        'Saidapet',
        'Kodambakkam',
        'Porur',
        'Egmore',
        'Nungambakkam',
      ],
    },
    {
      name: 'Coimbatore',
      aliases: ['Coimbatore', 'Kovai'],
      cities: [
        'Coimbatore',
        'Pollachi',
        'Mettupalayam',
        'Sulur',
        'Valparai',
        'Kinathukadavu',
        'Annur',
        'Thondamuthur',
        'Madukkarai',
        'Karamadai',
        'Saravanampatti',
        'Gandhipuram',
        'Peelamedu',
        'Singanallur',
        'RS Puram',
      ],
    },
    {
      name: 'Cuddalore',
      aliases: ['Cuddalore'],
      cities: [
        'Cuddalore',
        'Chidambaram',
        'Virudhachalam',
        'Panruti',
        'Neyveli',
        'Kurinjipadi',
        'Kattumannarkoil',
        'Bhuvanagiri',
        'Tittakudi',
        'Vadalur',
      ],
    },
    {
      name: 'Dharmapuri',
      aliases: ['Dharmapuri'],
      cities: [
        'Dharmapuri',
        'Harur',
        'Pappireddipatti',
        'Palacode',
        'Karimangalam',
        'Pennagaram',
        'Marandahalli',
        'Morappur',
      ],
    },
    {
      name: 'Dindigul',
      aliases: ['Dindigul'],
      cities: [
        'Dindigul',
        'Palani',
        'Kodaikanal',
        'Oddanchatram',
        'Natham',
        'Vedasandur',
        'Nilakkottai',
        'Batlagundu',
        'Chinnalapatti',
        'Authoor',
      ],
    },
    {
      name: 'Erode',
      aliases: ['Erode'],
      cities: [
        'Erode',
        'Gobichettipalayam',
        'Sathyamangalam',
        'Bhavani',
        'Perundurai',
        'Kodumudi',
        'Modakkurichi',
        'Anthiyur',
        'Chennimalai',
        'Bhavanisagar',
      ],
    },
    {
      name: 'Kallakurichi',
      aliases: ['Kallakurichi'],
      cities: [
        'Kallakurichi',
        'Thirukkoyilur',
        'Ulundurpettai',
        'Sankarapuram',
        'Chinnasalem',
        'Kalvarayan Hills',
        'Rishivandiyam',
      ],
    },
    {
      name: 'Kancheepuram',
      aliases: ['Kancheepuram', 'Kanchipuram'],
      cities: [
        'Kancheepuram',
        'Kanchipuram',
        'Sriperumbudur',
        'Uthiramerur',
        'Walajabad',
        'Kundrathur',
        'Sunguvarchatram',
      ],
    },
    {
      name: 'Kanniyakumari',
      aliases: ['Kanniyakumari', 'Kanyakumari'],
      cities: [
        'Nagercoil',
        'Kanyakumari',
        'Kanniyakumari',
        'Kulithurai',
        'Padmanabhapuram',
        'Colachel',
        'Kuzhithurai',
        'Marthandam',
        'Thuckalay',
        'Thiruvattar',
        'Killiyoor',
      ],
    },
    {
      name: 'Karur',
      aliases: ['Karur'],
      cities: [
        'Karur',
        'Kulithalai',
        'Aravakurichi',
        'Krishnarayapuram',
        'Manmangalam',
        'Pugalur',
        'Pallapatti',
      ],
    },
    {
      name: 'Krishnagiri',
      aliases: ['Krishnagiri'],
      cities: [
        'Krishnagiri',
        'Hosur',
        'Denkanikottai',
        'Uthangarai',
        'Pochampalli',
        'Bargur',
        'Shoolagiri',
        'Kelamangalam',
        'Rayakottai',
      ],
    },
    {
      name: 'Madurai',
      aliases: ['Madurai'],
      cities: [
        'Madurai',
        'Melur',
        'Thirumangalam',
        'Usilampatti',
        'Vadipatti',
        'Peraiyur',
        'Alanganallur',
        'Sholavandan',
        'Thiruparankundram',
        'Othakadai',
      ],
    },
    {
      name: 'Mayiladuthurai',
      aliases: ['Mayiladuthurai'],
      cities: [
        'Mayiladuthurai',
        'Sirkazhi',
        'Tharangambadi',
        'Kuthalam',
        'Vaitheeswarankoil',
        'Poompuhar',
        'Sembanarkoil',
      ],
    },
    {
      name: 'Nagapattinam',
      aliases: ['Nagapattinam'],
      cities: [
        'Nagapattinam',
        'Vedaranyam',
        'Kilvelur',
        'Thirukkuvalai',
        'Velankanni',
        'Nagore',
      ],
    },
    {
      name: 'Namakkal',
      aliases: ['Namakkal'],
      cities: [
        'Namakkal',
        'Tiruchengode',
        'Rasipuram',
        'Paramathi Velur',
        'Kumarapalayam',
        'Sendamangalam',
        'Kolli Hills',
        'Mohanur',
        'Mallasamudram',
      ],
    },
    {
      name: 'Nilgiris',
      aliases: ['Nilgiris', 'The Nilgiris'],
      cities: [
        'Udhagamandalam',
        'Ooty',
        'Coonoor',
        'Kotagiri',
        'Gudalur',
        'Wellington',
        'Pandalur',
        'Kundah',
      ],
    },
    {
      name: 'Perambalur',
      aliases: ['Perambalur'],
      cities: [
        'Perambalur',
        'Kunnam',
        'Veppanthattai',
        'Alathur',
        'Poolambadi',
        'Labbaikudikadu',
      ],
    },
    {
      name: 'Pudukkottai',
      aliases: ['Pudukkottai', 'Pudukottai'],
      cities: [
        'Pudukkottai',
        'Aranthangi',
        'Illuppur',
        'Gandarvakottai',
        'Alangudi',
        'Thirumayam',
        'Ponnamaravathi',
        'Avudaiyarkoil',
        'Karambakkudi',
        'Viralimalai',
      ],
    },
    {
      name: 'Ramanathapuram',
      aliases: ['Ramanathapuram', 'Ramnad'],
      cities: [
        'Ramanathapuram',
        'Paramakudi',
        'Rameswaram',
        'Kilakarai',
        'Mudukulathur',
        'Kamuthi',
        'Tiruvadanai',
        'Kadaladi',
        'Mandapam',
      ],
    },
    {
      name: 'Ranipet',
      aliases: ['Ranipet'],
      cities: [
        'Ranipet',
        'Arakkonam',
        'Walajah',
        'Arcot',
        'Sholinghur',
        'Nemili',
        'Kalavai',
        'Thakkolam',
      ],
    },
    {
      name: 'Salem',
      aliases: ['Salem'],
      cities: [
        'Salem',
        'Attur',
        'Mettur',
        'Omalur',
        'Sankagiri',
        'Edappadi',
        'Yercaud',
        'Gangavalli',
        'Valapady',
        'Tharamangalam',
        'Jalakandapuram',
      ],
    },
    {
      name: 'Sivaganga',
      aliases: ['Sivaganga', 'Sivagangai'],
      cities: [
        'Sivaganga',
        'Karaikudi',
        'Devakottai',
        'Thiruppuvanam',
        'Manamadurai',
        'Kalaiyarkoil',
        'Singampunari',
        'Tirupathur',
        'Ilayangudi',
      ],
    },
    {
      name: 'Tenkasi',
      aliases: ['Tenkasi'],
      cities: [
        'Tenkasi',
        'Sankarankovil',
        'Kadayanallur',
        'Sengottai',
        'Sivagiri',
        'Alangulam',
        'Veerakeralamputhur',
        'Thiruvengadam',
        'Surandai',
        'Shenkottai',
      ],
    },
    {
      name: 'Thanjavur',
      aliases: ['Thanjavur', 'Tanjore'],
      cities: [
        'Thanjavur',
        'Kumbakonam',
        'Pattukkottai',
        'Thiruvaiyaru',
        'Orathanadu',
        'Peravurani',
        'Budalur',
        'Papanasam',
        'Thiruvidaimarudur',
      ],
    },
    {
      name: 'Theni',
      aliases: ['Theni'],
      cities: [
        'Theni',
        'Bodinayakanur',
        'Periyakulam',
        'Uthamapalayam',
        'Andipatti',
        'Cumbum',
        'Chinnamanur',
        'Thevaram',
      ],
    },
    {
      name: 'Thoothukudi',
      aliases: ['Thoothukudi', 'Thoothukkudi', 'Tuticorin'],
      cities: [
        'Thoothukudi',
        'Thoothukkudi',
        'Kovilpatti',
        'Tiruchendur',
        'Srivaikuntam',
        'Sathankulam',
        'Ettayapuram',
        'Vilathikulam',
        'Kayathar',
        'Udangudi',
        'Eral',
      ],
    },
    {
      name: 'Tiruchirappalli',
      aliases: ['Tiruchirappalli', 'Trichy', 'Tiruchirapalli'],
      cities: [
        'Tiruchirappalli',
        'Trichy',
        'Srirangam',
        'Manapparai',
        'Thuraiyur',
        'Lalgudi',
        'Musiri',
        'Thottiyam',
        'Manachanallur',
        'Thiruverumbur',
      ],
    },
    {
      name: 'Tirunelveli',
      aliases: ['Tirunelveli', 'Nellai'],
      cities: [
        'Tirunelveli',
        'Palayamkottai',
        'Ambasamudram',
        'Nanguneri',
        'Radhapuram',
        'Cheranmahadevi',
        'Thisayanvilai',
        'Kalakkad',
        'Valliyur',
      ],
    },
    {
      name: 'Tirupathur',
      aliases: ['Tirupathur', 'Tirupattur'],
      cities: [
        'Tirupathur',
        'Tirupattur',
        'Vaniyambadi',
        'Ambur',
        'Jolarpet',
        'Natrampalli',
        'Alangayam',
      ],
    },
    {
      name: 'Tiruppur',
      aliases: ['Tiruppur', 'Tirupur'],
      cities: [
        'Tiruppur',
        'Avinashi',
        'Palladam',
        'Dharapuram',
        'Kangeyam',
        'Udumalaipettai',
        'Madathukulam',
        'Uthukuli',
        'Vellakovil',
      ],
    },
    {
      name: 'Tiruvallur',
      aliases: ['Tiruvallur', 'Thiruvallur'],
      cities: [
        'Tiruvallur',
        'Poonamallee',
        'Avadi',
        'Tiruttani',
        'Gummidipoondi',
        'Ponneri',
        'Uthukottai',
        'Minjur',
        'Pattabiram',
        'Red Hills',
      ],
    },
    {
      name: 'Tiruvannamalai',
      aliases: ['Tiruvannamalai', 'Thiruvannamalai'],
      cities: [
        'Tiruvannamalai',
        'Arni',
        'Cheyyar',
        'Vandavasi',
        'Polur',
        'Chengam',
        'Kalasapakkam',
        'Kilpennathur',
        'Chetpet',
        'Jawadhu Hills',
      ],
    },
    {
      name: 'Tiruvarur',
      aliases: ['Tiruvarur', 'Thiruvarur'],
      cities: [
        'Tiruvarur',
        'Thiruvarur',
        'Mannargudi',
        'Thiruthuraipoondi',
        'Needamangalam',
        'Nannilam',
        'Kodavasal',
        'Valangaiman',
        'Koothanallur',
      ],
    },
    {
      name: 'Vellore',
      aliases: ['Vellore'],
      cities: [
        'Vellore',
        'Katpadi',
        'Gudiyatham',
        'Pernambut',
        'Anaicut',
        'KV Kuppam',
      ],
    },
    {
      name: 'Viluppuram',
      aliases: ['Viluppuram', 'Villupuram'],
      cities: [
        'Viluppuram',
        'Villupuram',
        'Tindivanam',
        'Gingee',
        'Vikravandi',
        'Vanur',
        'Marakkanam',
        'Kandachipuram',
        'Valavanur',
      ],
    },
    {
      name: 'Virudhunagar',
      aliases: ['Virudhunagar', 'Virudunagar'],
      cities: [
        'Virudhunagar',
        'Sivakasi',
        'Rajapalayam',
        'Srivilliputhur',
        'Aruppukkottai',
        'Sattur',
        'Watrap',
        'Kariapatti',
        'Thiruthangal',
      ],
    },
  ],
};

async function seedTamilNaduCities() {
  console.log('🚀 Starting Tamil Nadu Districts & Cities Seeder...');

  try {
    // 1. Authenticate Database
    await sequelize.authenticate();
    console.log('✅ Database connected successfully.');

    // 2. Find or Create State: Tamil Nadu
    let [state] = await State.findOrCreate({
      where: { name: tamilNaduData.stateName },
      defaults: {
        name: tamilNaduData.stateName,
        code: tamilNaduData.stateCode,
      },
    });
    console.log(`📍 State confirmed: ${state.name} (ID: ${state.id})`);

    let totalDistrictsProcessed = 0;
    let newDistrictsCreated = 0;
    let totalCitiesProcessed = 0;
    let newCitiesCreated = 0;

    // 3. Process each district
    for (const districtInfo of tamilNaduData.districts) {
      totalDistrictsProcessed++;

      // Check if district already exists by name or aliases
      const searchNames = Array.from(new Set([districtInfo.name, ...(districtInfo.aliases || [])]));
      
      let district = await District.findOne({
        where: {
          state_id: state.id,
          [Op.or]: searchNames.map((n) =>
            seqWhere(fn('LOWER', col('name')), n.trim().toLowerCase())
          ),
        },
      });

      if (!district) {
        district = await District.create({
          name: districtInfo.name,
          state_id: state.id,
        });
        newDistrictsCreated++;
        console.log(`  ➕ Created District: ${district.name}`);
      }

      // Ensure the district name itself is included in cities list
      const cityNames = Array.from(new Set([district.name, ...districtInfo.cities]));

      // 4. Process cities for this district
      for (const cityName of cityNames) {
        totalCitiesProcessed++;

        // Check if city exists under this district (case-insensitive)
        let city = await City.findOne({
          where: {
            state_id: state.id,
            district_id: district.id,
            [Op.and]: seqWhere(fn('LOWER', col('name')), cityName.trim().toLowerCase()),
          },
        });

        if (!city) {
          // Fallback check: City may exist under this state with null district_id or same name
          const existingCity = await City.findOne({
            where: {
              state_id: state.id,
              [Op.and]: seqWhere(fn('LOWER', col('name')), cityName.trim().toLowerCase()),
            },
          });

          if (existingCity) {
            // Update district_id if it was null
            if (!existingCity.district_id) {
              await existingCity.update({ district_id: district.id });
              console.log(`  🔄 Linked existing city '${existingCity.name}' to district '${district.name}'`);
            }
          } else {
            await City.create({
              name: cityName.trim(),
              state_id: state.id,
              district_id: district.id,
            });
            newCitiesCreated++;
          }
        }
      }
    }

    // 5. Invalidate location cache in Redis if active
    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.del('locations:hierarchy');
        console.log('🧹 Flushed redis cache key: locations:hierarchy');
      } catch (cacheErr) {
        console.warn('⚠️ Could not flush redis cache:', cacheErr.message);
      }
    }

    console.log('\n=============================================');
    console.log('🎉 Tamil Nadu Seeding Completed Successfully!');
    console.log(`📊 Districts Processed: ${totalDistrictsProcessed} (New Created: ${newDistrictsCreated})`);
    console.log(`🏙️  Cities Processed: ${totalCitiesProcessed} (New Created: ${newCitiesCreated})`);
    console.log('=============================================\n');
  } catch (error) {
    console.error('❌ Error seeding Tamil Nadu cities:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  seedTamilNaduCities()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedTamilNaduCities;
