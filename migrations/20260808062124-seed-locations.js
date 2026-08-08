'use strict';

const crypto = require('crypto');

// ─── Location Seeder Data (All 28 States + 8 UTs of India) ────────────────────
const locationTree = {
  'Tamil Nadu': { code: 'TN', districts: {
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
  }},
  'Kerala': { code: 'KL', districts: {
    'Thiruvananthapuram': ['Thiruvananthapuram', 'Neyyattinkara'],
    'Ernakulam': ['Kochi', 'Aluva', 'Muvattupuzha'],
    'Kozhikode': ['Kozhikode', 'Vatakara'],
    'Thrissur': ['Thrissur', 'Chalakudy'],
    'Kollam': ['Kollam', 'Punalur'],
    'Kannur': ['Kannur', 'Thalassery'],
    'Alappuzha': ['Alappuzha', 'Cherthala'],
    'Palakkad': ['Palakkad', 'Ottapalam']
  }},
  'Karnataka': { code: 'KA', districts: {
    'Bengaluru Urban': ['Bengaluru', 'Electronic City', 'Whitefield'],
    'Mysuru': ['Mysuru', 'Nanjangud'],
    'Dharwad': ['Hubli', 'Dharwad'],
    'Dakshina Kannada': ['Mangaluru', 'Puttur'],
    'Belagavi': ['Belagavi', 'Chikkodi'],
    'Shivamogga': ['Shivamogga', 'Bhadravathi'],
    'Tumakuru': ['Tumakuru', 'Sira']
  }},
  'Andhra Pradesh': { code: 'AP', districts: {
    'Visakhapatnam': ['Visakhapatnam', 'Anakapalle'],
    'NTR': ['Vijayawada'],
    'Guntur': ['Guntur', 'Tenali'],
    'Tirupati': ['Tirupati', 'Srikalahasti'],
    'Kurnool': ['Kurnool', 'Adoni'],
    'SPSR Nellore': ['Nellore', 'Kavali']
  }},
  'Telangana': { code: 'TS', districts: {
    'Hyderabad': ['Hyderabad', 'Secunderabad'],
    'Hanamkonda': ['Warangal', 'Hanamkonda'],
    'Karimnagar': ['Karimnagar'],
    'Nizamabad': ['Nizamabad'],
    'Khammam': ['Khammam']
  }},
  'Maharashtra': { code: 'MH', districts: {
    'Mumbai City': ['Mumbai', 'South Mumbai'],
    'Pune': ['Pune', 'Pimpri-Chinchwad'],
    'Nagpur': ['Nagpur'],
    'Nashik': ['Nashik'],
    'Chhatrapati Sambhajinagar': ['Aurangabad'],
    'Kolhapur': ['Kolhapur'],
    'Solapur': ['Solapur'],
    'Thane': ['Thane', 'Kalyan', 'Navi Mumbai']
  }},
  'Gujarat': { code: 'GJ', districts: {
    'Ahmedabad': ['Ahmedabad', 'Sanand'],
    'Surat': ['Surat'],
    'Vadodara': ['Vadodara'],
    'Rajkot': ['Rajkot'],
    'Bhavnagar': ['Bhavnagar'],
    'Jamnagar': ['Jamnagar']
  }},
  'Delhi': { code: 'DL', districts: {
    'New Delhi': ['New Delhi'],
    'North Delhi': ['North Delhi'],
    'South Delhi': ['South Delhi'],
    'East Delhi': ['East Delhi'],
    'West Delhi': ['West Delhi']
  }},
  'Rajasthan': { code: 'RJ', districts: {
    'Jaipur': ['Jaipur'],
    'Jodhpur': ['Jodhpur'],
    'Udaipur': ['Udaipur'],
    'Ajmer': ['Ajmer'],
    'Kota': ['Kota'],
    'Bikaner': ['Bikaner']
  }},
  'Punjab': { code: 'PB', districts: {
    'Ludhiana': ['Ludhiana'],
    'Amritsar': ['Amritsar'],
    'Jalandhar': ['Jalandhar'],
    'Patiala': ['Patiala'],
    'SAS Nagar': ['Mohali']
  }},
  'Uttar Pradesh': { code: 'UP', districts: {
    'Lucknow': ['Lucknow'],
    'Kanpur Nagar': ['Kanpur'],
    'Agra': ['Agra'],
    'Varanasi': ['Varanasi'],
    'Prayagraj': ['Prayagraj'],
    'Gautam Buddha Nagar': ['Noida'],
    'Ghaziabad': ['Ghaziabad'],
    'Meerut': ['Meerut']
  }},
  'West Bengal': { code: 'WB', districts: {
    'Kolkata': ['Kolkata'],
    'Howrah': ['Howrah'],
    'Paschim Bardhaman': ['Durgapur', 'Asansol'],
    'Darjeeling': ['Siliguri']
  }},
  'Madhya Pradesh': { code: 'MP', districts: {
    'Bhopal': ['Bhopal'],
    'Indore': ['Indore'],
    'Jabalpur': ['Jabalpur'],
    'Gwalior': ['Gwalior'],
    'Ujjain': ['Ujjain']
  }},
  'Haryana': { code: 'HR', districts: {
    'Gurugram': ['Gurugram'],
    'Faridabad': ['Faridabad'],
    'Panipat': ['Panipat'],
    'Hisar': ['Hisar'],
    'Ambala': ['Ambala']
  }},
  'Bihar': { code: 'BR', districts: {
    'Patna': ['Patna'],
    'Gaya': ['Gaya'],
    'Muzaffarpur': ['Muzaffarpur'],
    'Bhagalpur': ['Bhagalpur']
  }},
  'Odisha': { code: 'OD', districts: {
    'Khordha': ['Bhubaneswar'],
    'Cuttack': ['Cuttack'],
    'Sundargarh': ['Rourkela'],
    'Sambalpur': ['Sambalpur']
  }},
  'Assam': { code: 'AS', districts: {
    'Kamrup Metropolitan': ['Guwahati'],
    'Cachar': ['Silchar'],
    'Dibrugarh': ['Dibrugarh'],
    'Jorhat': ['Jorhat']
  }},
  'Chhattisgarh': { code: 'CG', districts: {
    'Raipur': ['Raipur'],
    'Durg': ['Bhilai', 'Durg'],
    'Bilaspur': ['Bilaspur'],
    'Korba': ['Korba']
  }},
  'Jharkhand': { code: 'JH', districts: {
    'Ranchi': ['Ranchi'],
    'East Singhbhum': ['Jamshedpur'],
    'Dhanbad': ['Dhanbad'],
    'Bokaro': ['Bokaro Steel City']
  }},
  'Himachal Pradesh': { code: 'HP', districts: {
    'Shimla': ['Shimla'],
    'Kangra': ['Dharamshala'],
    'Mandi': ['Mandi'],
    'Solan': ['Solan']
  }},
  'Uttarakhand': { code: 'UK', districts: {
    'Dehradun': ['Dehradun', 'Rishikesh'],
    'Haridwar': ['Haridwar', 'Roorkee'],
    'Nainital': ['Haldwani', 'Nainital']
  }},
  'Goa': { code: 'GA', districts: {
    'North Goa': ['Panaji', 'Mapusa'],
    'South Goa': ['Margao', 'Vasco da Gama']
  }},
  'Tripura': { code: 'TR', districts: {
    'West Tripura': ['Agartala']
  }},
  'Manipur': { code: 'MN', districts: {
    'Imphal East': ['Imphal']
  }},
  'Meghalaya': { code: 'ML', districts: {
    'East Khasi Hills': ['Shillong']
  }},
  'Nagaland': { code: 'NL', districts: {
    'Kohima': ['Kohima'],
    'Dimapur': ['Dimapur']
  }},
  'Mizoram': { code: 'MZ', districts: {
    'Aizawl': ['Aizawl']
  }},
  'Sikkim': { code: 'SK', districts: {
    'Gangtok': ['Gangtok']
  }},
  'Arunachal Pradesh': { code: 'AR', districts: {
    'Papum Pare': ['Itanagar']
  }},
  'Jammu and Kashmir': { code: 'JK', districts: {
    'Srinagar': ['Srinagar'],
    'Jammu': ['Jammu']
  }},
  'Ladakh': { code: 'LA', districts: {
    'Leh': ['Leh'],
    'Kargil': ['Kargil']
  }},
  'Chandigarh': { code: 'CH', districts: {
    'Chandigarh': ['Chandigarh']
  }},
  'Puducherry': { code: 'PY', districts: {
    'Puducherry': ['Puducherry'],
    'Karaikal': ['Karaikal']
  }},
  'Andaman and Nicobar Islands': { code: 'AN', districts: {
    'South Andaman': ['Port Blair']
  }},
  'Dadra and Nagar Haveli and Daman and Diu': { code: 'DN', districts: {
    'Daman': ['Daman'],
    'Diu': ['Diu'],
    'Dadra and Nagar Haveli': ['Silvassa']
  }},
  'Lakshadweep': { code: 'LD', districts: {
    'Lakshadweep': ['Kavaratti']
  }}
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 0. Check if locations are already seeded to prevent duplication or FK errors
    const [[{ count }]] = await queryInterface.sequelize.query('SELECT COUNT(*) AS count FROM states');
    if (count > 0) {
      console.log('📍 Locations already seeded in DB. Skipping migration.');
      return;
    }

    // 1. Prepare data structures
    const statesToInsert = [];
    const districtsToInsert = [];
    const citiesToInsert = [];
    const now = new Date();

    // 2. Loop and generate UUIDs locally
    for (const [stateName, stateInfo] of Object.entries(locationTree)) {
      const stateId = crypto.randomUUID();
      statesToInsert.push({
        id: stateId,
        name: stateName,
        code: stateInfo.code,
        created_at: now,
        updated_at: now
      });

      for (const [districtName, cityList] of Object.entries(stateInfo.districts)) {
        const districtId = crypto.randomUUID();
        districtsToInsert.push({
          id: districtId,
          state_id: stateId,
          name: districtName,
          created_at: now,
          updated_at: now
        });

        for (const cityName of cityList) {
          citiesToInsert.push({
            id: crypto.randomUUID(),
            state_id: stateId,
            district_id: districtId,
            name: cityName,
            created_at: now,
            updated_at: now
          });
        }
      }
    }

    // 3. Perform exactly three bulk inserts using 'ignoreDuplicates' to make it idempotent
    if (statesToInsert.length > 0) {
      await queryInterface.bulkInsert('states', statesToInsert, { ignoreDuplicates: true });
    }
    
    if (districtsToInsert.length > 0) {
      await queryInterface.bulkInsert('districts', districtsToInsert, { ignoreDuplicates: true });
    }
    
    if (citiesToInsert.length > 0) {
      await queryInterface.bulkInsert('cities', citiesToInsert, { ignoreDuplicates: true });
    }
  },

  async down(queryInterface, Sequelize) {
    // Delete all seeded data (cascade down usually handles districts and cities)
    await queryInterface.bulkDelete('cities', null, {});
    await queryInterface.bulkDelete('districts', null, {});
    await queryInterface.bulkDelete('states', null, {});
  }
};
