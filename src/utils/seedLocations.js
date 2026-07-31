const { State, District, City } = require('../models');
const logger = require('./logger');

// ─── Location Seeder Data ──────────────────────────────────────────────────────
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

    for (const [stateName, stateInfo] of Object.entries(locationTree)) {
      // Find or create state
      let [state] = await State.findOrCreate({
        where: { name: stateName },
        defaults: { name: stateName, code: stateInfo.code }
      });

      for (const [districtName, cityList] of Object.entries(stateInfo.districts)) {
        // Find or create district
        let [district] = await District.findOrCreate({
          where: { state_id: state.id, name: districtName },
          defaults: { state_id: state.id, name: districtName }
        });

        // Find or create cities and link to district
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

    logger.info('✅ States, Districts, and Cities seeded successfully');
  } catch (error) {
    logger.error('❌ Failed to seed locations:', error);
  }
};

module.exports = seedLocations;