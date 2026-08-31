require('dotenv').config();
const { Highlight } = require('../src/models');
const sequelize = require('../src/config/database');

const SEED_HIGHLIGHTS = [
  'Excellent Condition',
  'Less Driven',
  'VIP Number',
  'Single Owner',
  'Top Model',
  'Service History Available',
  'Non Accidental',
  'All Original',
  'Under Warranty',
  'Sunroof',
];

async function seedHighlights() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    for (const name of SEED_HIGHLIGHTS) {
      const [highlight, created] = await Highlight.findOrCreate({
        where: { name },
        defaults: { name, is_active: true },
      });
      console.log(`${created ? '✨ Created' : 'ℹ️ Exists'}: ${highlight.name} (${highlight.id})`);
    }

    console.log('🎉 Highlights seeded successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding highlights:', error);
    process.exit(1);
  }
}

seedHighlights();
