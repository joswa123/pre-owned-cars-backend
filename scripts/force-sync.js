const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const Car = require('../src/models/Car');
async function run() {
  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await User.sync({ force: true });
    await Car.sync({ force: true });
    
    const user = await User.create({
      full_name: 'Test Admin',
      phone: '1234567890',
      role: 'admin',
      password: 'password123'
    });
    
    const car = await Car.create({
      user_id: user.id,
      brand_id: null,
      model_id: null,
      year: 2020,
      price: 10000,
      status: 'active'
    });

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    console.log('SUCCESS');
    console.log('TEST_CAR_ID=' + car.id);
    console.log('TEST_TOKEN=' + token);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
require('dotenv').config();
run();
