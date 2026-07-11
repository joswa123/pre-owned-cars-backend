const { State, City } = require('../models');
const logger = require('./logger');

const statesData = [
  { name: 'Andhra Pradesh', code: 'AP' },
  { name: 'Arunachal Pradesh', code: 'AR' },
  { name: 'Assam', code: 'AS' },
  { name: 'Bihar', code: 'BR' },
  { name: 'Chhattisgarh', code: 'CG' },
  { name: 'Goa', code: 'GA' },
  { name: 'Gujarat', code: 'GJ' },
  { name: 'Haryana', code: 'HR' },
  { name: 'Himachal Pradesh', code: 'HP' },
  { name: 'Jharkhand', code: 'JH' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Kerala', code: 'KL' },
  { name: 'Madhya Pradesh', code: 'MP' },
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Manipur', code: 'MN' },
  { name: 'Meghalaya', code: 'ML' },
  { name: 'Mizoram', code: 'MZ' },
  { name: 'Nagaland', code: 'NL' },
  { name: 'Odisha', code: 'OD' },
  { name: 'Punjab', code: 'PB' },
  { name: 'Rajasthan', code: 'RJ' },
  { name: 'Sikkim', code: 'SK' },
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Telangana', code: 'TS' },
  { name: 'Tripura', code: 'TR' },
  { name: 'Uttar Pradesh', code: 'UP' },
  { name: 'Uttarakhand', code: 'UK' },
  { name: 'West Bengal', code: 'WB' },

  { name: 'Andaman and Nicobar Islands', code: 'AN' },
  { name: 'Chandigarh', code: 'CH' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN' },
  { name: 'Delhi', code: 'DL' },
  { name: 'Jammu and Kashmir', code: 'JK' },
  { name: 'Ladakh', code: 'LA' },
  { name: 'Lakshadweep', code: 'LD' },
  { name: 'Puducherry', code: 'PY' }
];

const citiesData = {
  'Tamil Nadu': [
    'Chennai',
    'Coimbatore',
    'Madurai',
    'Salem',
    'Erode',
    'Tiruppur',
    'Trichy',
    'Vellore',
    'Thoothukudi',
    'Nagercoil'
  ],

  'Kerala': [
    'Thiruvananthapuram',
    'Kochi',
    'Kozhikode',
    'Thrissur',
    'Kollam',
    'Kannur',
    'Alappuzha',
    'Palakkad'
  ],

  'Karnataka': [
    'Bengaluru',
    'Mysuru',
    'Hubli',
    'Mangaluru',
    'Belagavi',
    'Shivamogga',
    'Tumakuru'
  ],

  'Andhra Pradesh': [
    'Visakhapatnam',
    'Vijayawada',
    'Guntur',
    'Tirupati',
    'Kurnool',
    'Nellore'
  ],

  'Telangana': [
    'Hyderabad',
    'Warangal',
    'Karimnagar',
    'Nizamabad',
    'Khammam'
  ],

  'Maharashtra': [
    'Mumbai',
    'Pune',
    'Nagpur',
    'Nashik',
    'Aurangabad',
    'Kolhapur',
    'Solapur',
    'Thane'
  ],

  'Gujarat': [
    'Ahmedabad',
    'Surat',
    'Vadodara',
    'Rajkot',
    'Bhavnagar',
    'Jamnagar'
  ],

  'Delhi': [
    'New Delhi',
    'North Delhi',
    'South Delhi',
    'East Delhi',
    'West Delhi'
  ],

  'Rajasthan': [
    'Jaipur',
    'Jodhpur',
    'Udaipur',
    'Ajmer',
    'Kota',
    'Bikaner'
  ],

  'Punjab': [
    'Ludhiana',
    'Amritsar',
    'Jalandhar',
    'Patiala',
    'Mohali'
  ],

  'Uttar Pradesh': [
    'Lucknow',
    'Kanpur',
    'Agra',
    'Varanasi',
    'Prayagraj',
    'Noida',
    'Ghaziabad',
    'Meerut'
  ],

  'West Bengal': [
    'Kolkata',
    'Howrah',
    'Durgapur',
    'Siliguri',
    'Asansol'
  ],

  'Madhya Pradesh': [
    'Bhopal',
    'Indore',
    'Jabalpur',
    'Gwalior',
    'Ujjain'
  ],

  'Bihar': [
    'Patna',
    'Gaya',
    'Muzaffarpur',
    'Bhagalpur'
  ],

  'Odisha': [
    'Bhubaneswar',
    'Cuttack',
    'Rourkela',
    'Sambalpur'
  ],

  'Haryana': [
    'Gurugram',
    'Faridabad',
    'Panipat',
    'Hisar',
    'Ambala'
  ]
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