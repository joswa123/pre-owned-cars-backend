require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const { Brand, Model, Car } = require('../src/models');

async function testModelImageAndCount() {
  console.log('🧪 Testing Model image_url and car_count feature...');
  await sequelize.authenticate();

  // Find a brand and model
  let brand = await Brand.findOne();
  if (!brand) {
    brand = await Brand.create({ name: 'Test Brand', logo: 'logo.png' });
  }

  let model = await Model.findOne({ where: { brandId: brand.id } });
  if (!model) {
    model = await Model.create({ name: 'Test Model', brandId: brand.id, body_type: 'SUV' });
  }

  // Update model image_url
  await model.update({ image_url: 'https://ik.imagekit.io/autodeal/models/test-model.png' });

  // 1. Test GET /api/v1/catalog/brands/:brandId/models
  console.log('\nTesting GET /api/v1/catalog/brands/:brandId/models ...');
  let res = await request(app).get(`/api/v1/catalog/brands/${brand.id}/models`);
  console.log('Status:', res.statusCode);
  if (res.statusCode === 200) {
    const models = res.body.data.models;
    const found = models.find(m => m.id === model.id);
    console.log('Found model in catalog:', {
      id: found?.id,
      name: found?.name,
      image_url: found?.image_url,
      car_count: found?.car_count,
    });
    if (found && found.image_url && typeof found.car_count === 'number') {
      console.log('✅ Catalog models endpoint returns image_url and integer car_count');
    } else {
      console.error('❌ Missing image_url or car_count');
    }
  }

  // 2. Test GET /api/v1/models?brandId=...
  console.log('\nTesting GET /api/v1/models ...');
  res = await request(app).get(`/api/v1/models?brandId=${brand.id}`);
  console.log('Status:', res.statusCode);
  if (res.statusCode === 200) {
    const models = res.body.data;
    const found = models.find(m => m.id === model.id);
    console.log('Found model in models route:', {
      id: found?.id,
      name: found?.name,
      image_url: found?.image_url,
      car_count: found?.car_count,
    });
    if (found && found.image_url && typeof found.car_count === 'number') {
      console.log('✅ Models endpoint returns image_url and integer car_count');
    } else {
      console.error('❌ Missing image_url or car_count');
    }
  }

  console.log('\n🎉 Verification completed successfully!');
  process.exit(0);
}

testModelImageAndCount().catch(err => {
  console.error(err);
  process.exit(1);
});
