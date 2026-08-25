const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const { User, Car, Brand, Model, Variant, Lead, View, Wishlist } = require('../src/models');
const jwt = require('jsonwebtoken');
const redisClient = require('../src/config/redis');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone },
    process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production',
    { expiresIn: '1d' }
  );
};

async function testLeadSummaryHttp() {
  console.log('🚀 TESTING LEAD SUMMARY HTTP ENDPOINT & DASHBOARD RECONCILIATION...\n');

  try {
    await sequelize.authenticate();
    if (!redisClient.isOpen && !redisClient.isReady) {
      try {
        await redisClient.connect();
      } catch (e) {}
    }

    // 1. Setup Dealer and Buyer
    let seller = await User.findOne({ where: { role: 'dealer' } });
    if (!seller) {
      seller = await User.create({
        full_name: 'Lead HTTP Dealer',
        phone: '9555111222',
        role: 'dealer',
        password_hash: 'dummyhash',
      });
    }

    let buyer = await User.findOne({ where: { role: 'customer' } });
    if (!buyer) {
      buyer = await User.create({
        full_name: 'Lead HTTP Buyer',
        phone: '9555111333',
        role: 'customer',
        password_hash: 'dummyhash',
      });
    }

    const sellerToken = generateAccessToken(seller);

    let brand = await Brand.findOne({ where: { is_active: true } });
    if (!brand) {
      brand = await Brand.create({ name: 'Honda', is_active: true });
    }

    let carModel = await Model.findOne({ where: { brandId: brand.id } });
    if (!carModel) {
      carModel = await Model.create({ name: 'City', brandId: brand.id });
    }

    let variant = await Variant.findOne({ where: { model_id: carModel.id } });
    if (!variant) {
      variant = await Variant.create({ name: 'ZX', model_id: carModel.id });
    }

    // 2. Clean up any existing cars & leads for this test seller to isolate counts
    const existingCars = await Car.unscoped().findAll({ where: { user_id: seller.id } });
    const existingCarIds = existingCars.map(c => c.id);
    if (existingCarIds.length > 0) {
      await Lead.destroy({ where: { car_id: existingCarIds } });
      await View.destroy({ where: { car_id: existingCarIds } });
      await Wishlist.destroy({ where: { car_id: existingCarIds } });
      await Car.destroy({ where: { id: existingCarIds }, force: true });
    }

    // Invalidate Redis keys
    try {
      if (redisClient.isOpen) {
        const keys = await redisClient.keys(`seller:lead_summary:${seller.id}:*`);
        if (keys.length > 0) await redisClient.del(keys);
        await redisClient.del(`dashboard:user:${seller.id}`);
      }
    } catch (e) {}

    // 3. Create 1 SOLD car for the seller
    const carService = require('../src/services/carService');
    const leadService = require('../src/services/leadService');

    const soldCar = await carService.createCar(seller.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2022,
      price: 1200000,
      km_driven: 25000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      status: 'active',
      primary_image: 'honda-city.jpg',
    });

    // 4. Create 9 leads for this sold car (4 Calls, 4 Messages, 1 WhatsApp)
    // 4 Calls
    for (let i = 1; i <= 4; i++) {
      await leadService.createLead(buyer.id, {
        car_id: soldCar.id,
        name: `Call Buyer ${i}`,
        phone: `955500010${i}`,
        source: 'call',
        message: `Call lead ${i}`,
      });
    }

    // 4 Messages
    for (let i = 1; i <= 4; i++) {
      await leadService.createLead(buyer.id, {
        car_id: soldCar.id,
        name: `Message Buyer ${i}`,
        phone: `955500020${i}`,
        source: 'message',
        message: `Message lead ${i}`,
      });
    }

    // 1 WhatsApp
    await leadService.createLead(buyer.id, {
      car_id: soldCar.id,
      name: 'WhatsApp Buyer 1',
      phone: '9555000301',
      source: 'whatsapp',
      message: 'WhatsApp lead 1',
    });

    // Also add 1 view and 1 wishlist
    await carService.recordView(soldCar.id, buyer.id, '127.0.0.1');
    await Wishlist.create({ user_id: buyer.id, car_id: soldCar.id });

    // Mark the car as SOLD
    console.log('Marking car as SOLD...');
    await carService.markCarAsSold(soldCar.id, seller.id);

    // 5. Test GET /api/v1/users/me/dashboard HTTP
    console.log('\n--- 1. Testing GET /api/v1/users/me/dashboard ---');
    const dashRes = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${sellerToken}`);

    console.log('Dashboard Status:', dashRes.status);
    console.log('Dashboard Data:', JSON.stringify(dashRes.body.data?.leads, null, 2));

    if (dashRes.status !== 200) {
      throw new Error(`Dashboard request failed with status ${dashRes.status}`);
    }

    const dashLeads = dashRes.body.data.leads;
    if (dashLeads.total !== 9 || dashLeads.by_source.call !== 4 || dashLeads.by_source.message !== 4 || dashLeads.by_source.whatsapp !== 1) {
      throw new Error(`Dashboard lead counts mismatch: expected total 9 (4 calls, 4 messages, 1 whatsapp), got ${JSON.stringify(dashLeads)}`);
    }
    console.log('✅ Dashboard shows 9 leads (4 calls, 4 messages, 1 whatsapp)!');

    // 6. Test GET /api/v1/leads/summary?status=sold HTTP
    console.log('\n--- 2. Testing GET /api/v1/leads/summary?status=sold ---');
    const summaryRes = await request(app)
      .get('/api/v1/leads/summary?status=sold&limit=20')
      .set('Authorization', `Bearer ${sellerToken}`);

    console.log('Summary Status:', summaryRes.status);
    console.log('Summary Data:', JSON.stringify(summaryRes.body.data, null, 2));

    if (summaryRes.status !== 200) {
      throw new Error(`Summary request failed with status ${summaryRes.status}`);
    }

    const soldCarsList = summaryRes.body.data.cars;
    if (!soldCarsList || soldCarsList.length === 0) {
      throw new Error('No cars returned in /api/v1/leads/summary?status=sold');
    }

    const returnedCar = soldCarsList.find(c => c.car_id === soldCar.id);
    if (!returnedCar) {
      throw new Error(`Sold car ${soldCar.id} not found in summary!`);
    }

    console.log(`\nReturned Car Breakdown:`);
    console.log(`- total_lead_count: ${returnedCar.total_lead_count} (expected 9)`);
    console.log(`- calls: ${returnedCar.breakdown.calls} (expected 4)`);
    console.log(`- messages: ${returnedCar.breakdown.messages} (expected 4)`);
    console.log(`- whatsapp: ${returnedCar.breakdown.whatsapp} (expected 1)`);
    console.log(`- views: ${returnedCar.breakdown.views} (expected 1)`);
    console.log(`- wishlist: ${returnedCar.breakdown.wishlist} (expected 1)`);

    if (returnedCar.total_lead_count !== 9) {
      throw new Error(`Expected total_lead_count to be 9, got ${returnedCar.total_lead_count}`);
    }
    if (returnedCar.breakdown.calls !== 4) {
      throw new Error(`Expected calls to be 4, got ${returnedCar.breakdown.calls}`);
    }
    if (returnedCar.breakdown.messages !== 4) {
      throw new Error(`Expected messages to be 4, got ${returnedCar.breakdown.messages}`);
    }
    if (returnedCar.breakdown.whatsapp !== 1) {
      throw new Error(`Expected whatsapp to be 1, got ${returnedCar.breakdown.whatsapp}`);
    }

    console.log('✅ /api/v1/leads/summary?status=sold matches dashboard counts 100% (9 leads)!');

    // Clean up
    await Lead.destroy({ where: { car_id: soldCar.id } });
    await View.destroy({ where: { car_id: soldCar.id } });
    await Wishlist.destroy({ where: { car_id: soldCar.id } });
    await Car.destroy({ where: { id: soldCar.id }, force: true });

    console.log('\n🎉 ALL HTTP LEAD SUMMARY & DASHBOARD RECONCILIATION TESTS PASSED 100%!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

testLeadSummaryHttp();
