require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const sequelize = require('../src/config/database');
const { Brand, Model, Variant, Car, CarImage, User, State, District, City } = require('../src/models');

const carData = [
  {
    brand: 'Tata',
    model: 'Tiago',
    variant: 'XE',
    year: 2025,
    price: 2000000,
    km_driven: 2200,
    fuel_type: 'Electric',
    transmission: 'Manual',
    ownership: '1st Owner',
    body_type: 'Hatchback',
    board_type: 'T-Board', // Case must match ENUM: Own Board, T-Board, Commercial
    insurance_expiry_date: '2026-09-25',
    insurance_type: 'Not Insured',
    b2b_listing: false,
    posted_by_type: 'dealer',
    status: 'active',
    color: 'green',
    number_plate: 'TN-33 BV 4556',
    description: 'ADDITIONAL VEHICLE INFORMATION: ABS: Yes, Adjustable...',
    images: [
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786439903/cars/cars-1786439903631-286245755.webp',
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786439903/cars/cars-1786439903631-792032574.webp',
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786439903/cars/cars-1786439903631-784718580.webp',
    ],
  },
  {
    brand: 'Maruti Suzuki',
    model: 'Ertiga',
    variant: 'VXi CNG',
    year: 2023,
    price: 3500000,
    km_driven: 20000,
    fuel_type: 'CNG',
    transmission: 'Automatic',
    ownership: '3rd Owner',
    body_type: 'SUV',
    board_type: 'Commercial',
    insurance_expiry_date: '2032-09-24',
    insurance_type: 'Comprehensive',
    b2b_listing: false,
    posted_by_type: 'dealer',
    status: 'active',
    color: 'blue',
    number_plate: 'TN22 NV4567',
    description: 'CNG Petrol variant, Cargo, AC. New suspension system...',
    images: [
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786440364/cars/cars-1786440364450-412536030.webp',
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786440364/cars/cars-1786440364457-976293027.webp',
    ],
  },
  {
    brand: 'BMW',
    model: 'X1',
    variant: 'sDrive20i M Sport',
    year: 2024,
    price: 9000000,
    km_driven: 200000,
    fuel_type: 'Petrol',
    transmission: 'AMT',
    ownership: '2nd Owner',
    body_type: 'Hatchback',
    board_type: 'Own Board',
    insurance_expiry_date: '2026-08-11',
    insurance_type: 'Not Insured',
    b2b_listing: false,
    posted_by_type: 'dealer',
    status: 'active',
    color: 'white',
    number_plate: 'TN33 BV5555',
    description: '#BMWiX ●BMW iX xDrive50 (ELECTRIC) ●YEAR : 2024 ●K...',
    images: [
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786448093/cars/cars-1786448092931-259241291.webp',
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786448093/cars/cars-1786448092931-174529430.webp',
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786448093/cars/cars-1786448092930-115940404.webp',
      'https://res.cloudinary.com/fub1whjx/image/upload/v1786448093/cars/cars-1786448092930-551458647.webp',
    ],
  },
];

async function restoreCars() {
  const transaction = await sequelize.transaction();
  try {
    // Get the admin/dealer user (or create one)
    let user = await User.findOne({ where: { role: 'dealer' }, transaction });
    if (!user) {
      user = await User.create({
        id: require('crypto').randomUUID(),
        full_name: 'Test Dealer',
        phone: '9999999992',
        email: 'dealer@test.com',
        password_hash: await bcrypt.hash('SecurePass123', 12),
        role: 'dealer',
        is_verified: true,
      }, { transaction });
    }

    for (const car of carData) {
      // Find brand
      const brand = await Brand.findOne({ where: { name: car.brand }, transaction });
      if (!brand) {
        console.error(`❌ Brand "${car.brand}" not found. Skipping.`);
        continue;
      }

      // Find model
      const model = await Model.findOne({
        where: { name: car.model, brandId: brand.id },
        transaction,
      });
      if (!model) {
        console.error(`❌ Model "${car.model}" not found for brand "${car.brand}". Skipping.`);
        continue;
      }

      // Find variant
      const variant = await Variant.findOne({
        where: { name: car.variant, model_id: model.id },
        transaction,
      });
      if (!variant) {
        console.error(`❌ Variant "${car.variant}" not found for model "${car.model}". Skipping.`);
        continue;
      }

      // Create car
      const newCar = await Car.create({
        user_id: user.id,
        brand_id: brand.id,
        model_id: model.id,
        variant_id: variant.id,
        year: car.year,
        price: car.price,
        km_driven: car.km_driven,
        fuel_type: car.fuel_type,
        transmission: car.transmission,
        ownership: car.ownership,
        body_type: car.body_type,
        board_type: car.board_type,
        insurance_expiry_date: car.insurance_expiry_date,
        insurance_type: car.insurance_type,
        b2b_listing: car.b2b_listing,
        posted_by_type: car.posted_by_type,
        status: car.status,
        color: car.color,
        number_plate: car.number_plate,
        description: car.description,
      }, { transaction });

      // Add images
      for (const [index, url] of car.images.entries()) {
        await CarImage.create({
          car_id: newCar.id,
          image_url: url,
          is_primary: index === 0,
        }, { transaction });
      }

      console.log(`✅ Restored: ${car.brand} ${car.model} ${car.variant}`);
    }

    await transaction.commit();
    console.log('🎉 All cars restored successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Restoration failed:', error);
  } finally {
    process.exit(0);
  }
}

restoreCars();
