require('dotenv').config({ override: true });
const sequelize = require('../src/config/database');
const { Brand, Model, Variant } = require('../src/models');

const catalog = [
  {
    name: 'Tata',
    models: [
      {
        name: 'Tiago',
        body_type: 'Hatchback',
        variants: [
          { name: 'XE', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 565000 },
          { name: 'XZ+', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1199, price: 780000 }
        ]
      },
      {
        name: 'Nexon',
        body_type: 'SUV',
        variants: [
          { name: 'Smart', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 810000 }
        ]
      }
    ]
  },
  {
    name: 'Maruti Suzuki',
    models: [
      {
        name: 'Ertiga',
        body_type: 'MUV',
        variants: [
          { name: 'VXi CNG', fuel_type: 'CNG', transmission: 'Manual', engine_cc: 1462, price: 1073000 },
          { name: 'ZXi', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1462, price: 1120000 }
        ]
      },
      {
        name: 'Swift',
        body_type: 'Hatchback',
        variants: [
          { name: 'VXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 650000 },
          { name: 'ZXi+', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1197, price: 800000 }
        ]
      }
    ]
  },
  {
    name: 'BMW',
    models: [
      {
        name: 'X1',
        body_type: 'SUV',
        variants: [
          { name: 'sDrive20i M Sport', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1499, price: 4950000 },
          { name: 'sDrive18d M Sport', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1995, price: 5250000 }
        ]
      }
    ]
  },
  {
    name: 'Hyundai',
    models: [
      {
        name: 'Creta',
        body_type: 'SUV',
        variants: [
          { name: 'E', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1497, price: 1100000 }
        ]
      }
    ]
  },
  {
    name: 'Mahindra',
    models: [
      {
        name: 'Thar',
        body_type: 'SUV',
        variants: [
          { name: 'AX Opt 4-Str Hard Top Diesel', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 2184, price: 1450000 }
        ]
      }
    ]
  },
  {
    name: 'Other',
    models: [
      {
        name: 'Other Model',
        body_type: 'Others',
        variants: [
          { name: 'Other Variant', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1000, price: 0 }
        ]
      }
    ]
  }
];

async function seedCatalog() {
  const transaction = await sequelize.transaction();
  try {
    for (const brandData of catalog) {
      // 1. Seed Brand
      const [brand, brandCreated] = await Brand.findOrCreate({
        where: { name: brandData.name },
        defaults: { name: brandData.name, logo: '' },
        transaction
      });
      console.log(`${brandCreated ? 'Created' : 'Found'} Brand: ${brand.name}`);

      for (const modelData of brandData.models) {
        // 2. Seed Model
        const [model, modelCreated] = await Model.findOrCreate({
          where: { name: modelData.name, brandId: brand.id },
          defaults: { 
            name: modelData.name, 
            brandId: brand.id, 
            body_type: modelData.body_type 
          },
          transaction
        });
        console.log(`  - ${modelCreated ? 'Created' : 'Found'} Model: ${model.name}`);

        for (const variantData of modelData.variants) {
          // 3. Seed Variant
          const [variant, variantCreated] = await Variant.findOrCreate({
            where: { name: variantData.name, model_id: model.id },
            defaults: {
              name: variantData.name,
              model_id: model.id,
              fuel_type: variantData.fuel_type,
              transmission: variantData.transmission,
              engine_cc: variantData.engine_cc,
              price: variantData.price
            },
            transaction
          });
          console.log(`    -> ${variantCreated ? 'Created' : 'Found'} Variant: ${variant.name}`);
        }
      }
    }
    await transaction.commit();
    console.log('✅ Catalog seeded successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Failed to seed catalog', error);
  } finally {
    process.exit(0);
  }
}

seedCatalog();
