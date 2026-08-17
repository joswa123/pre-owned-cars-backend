'use strict';

const logos = {
  'Maruti Suzuki': 'https://www.carlogos.org/car-logos/suzuki-logo.png',
  'Hyundai': 'https://www.carlogos.org/car-logos/hyundai-logo.png',
  'Tata Motors': 'https://www.carlogos.org/car-logos/tata-logo.png',
  'Mahindra': 'https://www.carlogos.org/car-logos/mahindra-logo.png',
  'Toyota': 'https://www.carlogos.org/car-logos/toyota-logo.png',
  'Honda': 'https://www.carlogos.org/car-logos/honda-logo.png',
  'Kia': 'https://www.carlogos.org/car-logos/kia-logo.png',
  'Audi': 'https://www.carlogos.org/car-logos/audi-logo.png',
  'BMW': 'https://www.carlogos.org/car-logos/bmw-logo.png',
  'Jaguar': 'https://www.carlogos.org/car-logos/jaguar-logo.png',
  'Volkswagen': 'https://www.carlogos.org/car-logos/volkswagen-logo.png',
  'Skoda': 'https://www.carlogos.org/car-logos/skoda-logo.png',
  'Nissan': 'https://www.carlogos.org/car-logos/nissan-logo.png',
  'Renault': 'https://www.carlogos.org/car-logos/renault-logo.png',
  'Ford': 'https://www.carlogos.org/car-logos/ford-logo.png',
  'Jeep': 'https://www.carlogos.org/car-logos/jeep-logo.png',
  'MG': 'https://www.carlogos.org/car-logos/mg-logo.png',
  'BYD': 'https://www.carlogos.org/car-logos/byd-logo.png',
  'Citroën': 'https://www.carlogos.org/car-logos/citroen-logo.png',
  'Mercedes-Benz': 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png'
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const [name, logo] of Object.entries(logos)) {
        await queryInterface.sequelize.query(
          `UPDATE brands SET logo = :logo WHERE name = :name;`,
          {
            replacements: { logo, name },
            type: Sequelize.QueryTypes.UPDATE,
            transaction
          }
        );
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.resolve();
  }
};
