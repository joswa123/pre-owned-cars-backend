const { State, District, City } = require('../models');
const logger = require('./logger');

// ─── Location Seeder Data (All 28 States + 8 UTs of India) ────────────────────
const locationTree = {
  'Tamil Nadu': {
    code: 'TN',
    districts: {
      'Coimbatore': ['Coimbatore', 'Pollachi', 'Mettupalayam'],
      'Chennai': ['Chennai', 'Guindy', 'Velachery', 'Tambaram'],
      'Madurai': ['Madurai', 'Melur'],
      'Salem': ['Salem', 'Attur'],
      'Erode': ['Erode', 'Gobichettipalayam'],
      'Tiruppur': ['Tiruppur', 'Dharapuram'],
      'Tiruchirappalli': ['Trichy', 'Srirangam'],
      'Vellore': ['Vellore', 'Katpadi'],
      'Thoothukudi': ['Thoothukudi', 'Kovilpatti'],
      'Kanyakumari': ['Nagercoil', 'Marthandam']
    }
  },
  'Kerala': {
    code: 'KL',
    districts: {
      'Thiruvananthapuram': ['Thiruvananthapuram', 'Neyyattinkara'],
      'Ernakulam': ['Kochi', 'Aluva', 'Muvattupuzha'],
      'Kozhikode': ['Kozhikode', 'Vatakara'],
      'Thrissur': ['Thrissur', 'Chalakudy'],
      'Kollam': ['Kollam', 'Punalur'],
      'Kannur': ['Kannur', 'Thalassery'],
      'Alappuzha': ['Alappuzha', 'Cherthala'],
      'Palakkad': ['Palakkad', 'Ottapalam']
    }
  },
  'Karnataka': {
    code: 'KA',
    districts: {
      'Bengaluru Urban': ['Bengaluru', 'Electronic City', 'Whitefield'],
      'Mysuru': ['Mysuru', 'Nanjangud'],
      'Dharwad': ['Hubli', 'Dharwad'],
      'Dakshina Kannada': ['Mangaluru', 'Puttur'],
      'Belagavi': ['Belagavi', 'Chikkodi'],
      'Shivamogga': ['Shivamogga', 'Bhadravathi'],
      'Tumakuru': ['Tumakuru', 'Sira']
    }
  },
  'Andhra Pradesh': {
    code: 'AP',
    districts: {
      'Visakhapatnam': ['Visakhapatnam', 'Anakapalle'],
      'NTR': ['Vijayawada'],
      'Guntur': ['Guntur', 'Tenali'],
      'Tirupati': ['Tirupati', 'Srikalahasti'],
      'Kurnool': ['Kurnool', 'Adoni'],
      'SPSR Nellore': ['Nellore', 'Kavali']
    }
  },
  'Telangana': {
    code: 'TS',
    districts: {
      'Hyderabad': ['Hyderabad', 'Secunderabad'],
      'Hanamkonda': ['Warangal', 'Hanamkonda'],
      'Karimnagar': ['Karimnagar'],
      'Nizamabad': ['Nizamabad'],
      'Khammam': ['Khammam']
    }
  },
  'Maharashtra': {
    code: 'MH',
    districts: {
      'Mumbai City': ['Mumbai', 'South Mumbai'],
      'Pune': ['Pune', 'Pimpri-Chinchwad'],
      'Nagpur': ['Nagpur'],
      'Nashik': ['Nashik'],
      'Chhatrapati Sambhajinagar': ['Aurangabad'],
      'Kolhapur': ['Kolhapur'],
      'Solapur': ['Solapur'],
      'Thane': ['Thane', 'Kalyan', 'Navi Mumbai']
    }
  },
  'Gujarat': {
    code: 'GJ',
    districts: {
      'Ahmedabad': ['Ahmedabad', 'Sanand'],
      'Surat': ['Surat'],
      'Vadodara': ['Vadodara'],
      'Rajkot': ['Rajkot'],
      'Bhavnagar': ['Bhavnagar'],
      'Jamnagar': ['Jamnagar']
    }
  },
  'Delhi': {
    code: 'DL',
    districts: {
      'New Delhi': ['New Delhi'],
      'North Delhi': ['North Delhi'],
      'South Delhi': ['South Delhi'],
      'East Delhi': ['East Delhi'],
      'West Delhi': ['West Delhi']
    }
  },
  'Rajasthan': {
    code: 'RJ',
    districts: {
      'Jaipur': ['Jaipur'],
      'Jodhpur': ['Jodhpur'],
      'Udaipur': ['Udaipur'],
      'Ajmer': ['Ajmer'],
      'Kota': ['Kota'],
      'Bikaner': ['Bikaner']
    }
  },
  'Punjab': {
    code: 'PB',
    districts: {
      'Ludhiana': ['Ludhiana'],
      'Amritsar': ['Amritsar'],
      'Jalandhar': ['Jalandhar'],
      'Patiala': ['Patiala'],
      'SAS Nagar': ['Mohali']
    }
  },
  'Uttar Pradesh': {
    code: 'UP',
    districts: {
      'Lucknow': ['Lucknow'],
      'Kanpur Nagar': ['Kanpur'],
      'Agra': ['Agra'],
      'Varanasi': ['Varanasi'],
      'Prayagraj': ['Prayagraj'],
      'Gautam Buddha Nagar': ['Noida'],
      'Ghaziabad': ['Ghaziabad'],
      'Meerut': ['Meerut']
    }
  },
  'West Bengal': {
    code: 'WB',
    districts: {
      'Kolkata': ['Kolkata'],
      'Howrah': ['Howrah'],
      'Paschim Bardhaman': ['Durgapur', 'Asansol'],
      'Darjeeling': ['Siliguri']
    }
  },
  'Madhya Pradesh': {
    code: 'MP',
    districts: {
      'Bhopal': ['Bhopal'],
      'Indore': ['Indore'],
      'Jabalpur': ['Jabalpur'],
      'Gwalior': ['Gwalior'],
      'Ujjain': ['Ujjain']
    }
  },
  'Haryana': {
    code: 'HR',
    districts: {
      'Gurugram': ['Gurugram'],
      'Faridabad': ['Faridabad'],
      'Panipat': ['Panipat'],
      'Hisar': ['Hisar'],
      'Ambala': ['Ambala']
    }
  },
  'Bihar': {
    code: 'BR',
    districts: {
      'Patna': ['Patna'],
      'Gaya': ['Gaya'],
      'Muzaffarpur': ['Muzaffarpur'],
      'Bhagalpur': ['Bhagalpur']
    }
  },
  'Odisha': {
    code: 'OD',
    districts: {
      'Khordha': ['Bhubaneswar'],
      'Cuttack': ['Cuttack'],
      'Sundargarh': ['Rourkela'],
      'Sambalpur': ['Sambalpur']
    }
  },
  'Assam': {
    code: 'AS',
    districts: {
      'Kamrup Metropolitan': ['Guwahati'],
      'Cachar': ['Silchar'],
      'Dibrugarh': ['Dibrugarh'],
      'Jorhat': ['Jorhat']
    }
  },
  'Chhattisgarh': {
    code: 'CG',
    districts: {
      'Raipur': ['Raipur'],
      'Durg': ['Bhilai', 'Durg'],
      'Bilaspur': ['Bilaspur'],
      'Korba': ['Korba']
    }
  },
  'Jharkhand': {
    code: 'JH',
    districts: {
      'Ranchi': ['Ranchi'],
      'East Singhbhum': ['Jamshedpur'],
      'Dhanbad': ['Dhanbad'],
      'Bokaro': ['Bokaro Steel City']
    }
  },
  'Himachal Pradesh': {
    code: 'HP',
    districts: {
      'Shimla': ['Shimla'],
      'Kangra': ['Dharamshala'],
      'Mandi': ['Mandi'],
      'Solan': ['Solan']
    }
  },
  'Uttarakhand': {
    code: 'UK',
    districts: {
      'Dehradun': ['Dehradun', 'Rishikesh'],
      'Haridwar': ['Haridwar', 'Roorkee'],
      'Nainital': ['Haldwani', 'Nainital']
    }
  },
  'Goa': {
    code: 'GA',
    districts: {
      'North Goa': ['Panaji', 'Mapusa'],
      'South Goa': ['Margao', 'Vasco da Gama']
    }
  },
  'Tripura': {
    code: 'TR',
    districts: {
      'West Tripura': ['Agartala']
    }
  },
  'Manipur': {
    code: 'MN',
    districts: {
      'Imphal East': ['Imphal']
    }
  },
  'Meghalaya': {
    code: 'ML',
    districts: {
      'East Khasi Hills': ['Shillong']
    }
  },
  'Nagaland': {
    code: 'NL',
    districts: {
      'Kohima': ['Kohima'],
      'Dimapur': ['Dimapur']
    }
  },
  'Mizoram': {
    code: 'MZ',
    districts: {
      'Aizawl': ['Aizawl']
    }
  },
  'Sikkim': {
    code: 'SK',
    districts: {
      'Gangtok': ['Gangtok']
    }
  },
  'Arunachal Pradesh': {
    code: 'AR',
    districts: {
      'Papum Pare': ['Itanagar']
    }
  },
  'Jammu and Kashmir': {
    code: 'JK',
    districts: {
      'Srinagar': ['Srinagar'],
      'Jammu': ['Jammu']
    }
  },
  'Ladakh': {
    code: 'LA',
    districts: {
      'Leh': ['Leh'],
      'Kargil': ['Kargil']
    }
  },
  'Chandigarh': {
    code: 'CH',
    districts: {
      'Chandigarh': ['Chandigarh']
    }
  },
  'Puducherry': {
    code: 'PY',
    districts: {
      'Puducherry': ['Puducherry'],
      'Karaikal': ['Karaikal']
    }
  },
  'Andaman and Nicobar Islands': {
    code: 'AN',
    districts: {
      'South Andaman': ['Port Blair']
    }
  },
  'Dadra and Nagar Haveli and Daman and Diu': {
    code: 'DN',
    districts: {
      'Daman': ['Daman'],
      'Diu': ['Diu'],
      'Dadra and Nagar Haveli': ['Silvassa']
    }
  },
  'Lakshadweep': {
    code: 'LD',
    districts: {
      'Lakshadweep': ['Kavaratti']
    }
  }
};

const seedLocations = async (force = false) => {
  try {
    const districtCount = await District.count();

    // If districts are already seeded and force is not true, skip
    if (districtCount > 0 && !force) {
      logger.info('📍 Districts and locations already fully seeded');
      return;
    }

    logger.info('⏳ Seeding States, Districts, and Cities...');

    // 1. Process all entries in locationTree
    for (const [stateName, stateInfo] of Object.entries(locationTree)) {
      let [state] = await State.findOrCreate({
        where: { name: stateName },
        defaults: { name: stateName, code: stateInfo.code }
      });

      for (const [districtName, cityList] of Object.entries(stateInfo.districts)) {
        let [district] = await District.findOrCreate({
          where: { state_id: state.id, name: districtName },
          defaults: { state_id: state.id, name: districtName }
        });

        for (const cityName of cityList) {
          let city = await City.findOne({ where: { state_id: state.id, name: cityName } });
          if (city) {
            if (!city.district_id) {
              await city.update({ district_id: district.id });
            }
          } else {
            await City.create({
              state_id: state.id,
              district_id: district.id,
              name: cityName
            });
          }
        }
      }
    }

    // 2. FALLBACK GUARANTEE: Ensure EVERY state in DB has at least one District and linked Cities
    const allDbStates = await State.findAll();
    for (const state of allDbStates) {
      const dCount = await District.count({ where: { state_id: state.id } });
      if (dCount === 0) {
        logger.info(`📍 Generating fallback district for state: ${state.name}`);
        const defaultDistrictName = `${state.name} District`;
        const district = await District.create({
          state_id: state.id,
          name: defaultDistrictName
        });

        // Link any orphan cities belonging to this state to the new district
        const [updatedRows] = await City.update(
          { district_id: district.id },
          { where: { state_id: state.id, district_id: null } }
        );

        if (updatedRows === 0) {
          logger.info(`📍 Generating fallback city for district: ${district.name}`);
          await City.create({
            state_id: state.id,
            district_id: district.id,
            name: `${state.name} City`
          });
        }
      }
    }

    logger.info('✅ States, Districts, and Cities fully seeded across all Indian states and UTs');
  } catch (error) {
    logger.error('❌ Failed to seed locations:', error);
  }
};

module.exports = seedLocations;