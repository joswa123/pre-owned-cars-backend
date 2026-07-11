const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const logger = require('./utils/logger');
const seedAdmin = require('./utils/admin');
const PORT = process.env.PORT || 5000;
const seedLocations = require('./utils/seedLocations')
sequelize
  .authenticate()
  .then(() => {
    logger.info('Database connected');
    return sequelize.sync({ alter: true }); // careful in production
  })
  .then(() => {
    return seedAdmin();
  })
  .then(() => {
    // Seed states and cities
    return seedLocations();
  })
  .then(()  => {
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('DB connection failed:', err);
    process.exit(1);
  });