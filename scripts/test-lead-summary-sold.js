const sequelize = require('../src/config/database');
const { User, Car, Brand, Model, Variant, Lead, View, Wishlist } = require('../src/models');
const carService = require('../src/services/carService');
const leadService = require('../src/services/leadService');
const dashboardService = require('../src/services/dashboardService');
const redisClient = require('../src/config/redis');

async function testLeadSummarySold() {
  console.log('🚀 TESTING LEAD SUMMARY FOR SOLD CARS & DASHBOARD RECONCILIATION...\n');

  try {
    await sequelize.authenticate();
    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
      } catch (e) {}
    }

    // 1. Setup Dealer and Buyer
    let seller = await User.findOne({ where: { role: 'dealer' } });
    if (!seller) {
      seller = await User.create({
        full_name: 'Lead Test Dealer',
        phone: '9777111222',
        role: 'dealer',
        password_hash: 'hash123',
      });
    }

    let buyer = await User.findOne({ where: { role: 'customer' } });
    if (!buyer) {
      buyer = await User.create({
        full_name: 'Lead Test Buyer',
        phone: '9777111333',
        role: 'customer',
        password_hash: 'hash123',
      });
    }

    let brand = await Brand.findOne({ where: { is_active: true } });
    if (!brand) {
      brand = await Brand.create({ name: 'Toyota', is_active: true });
    }

    let carModel = await Model.findOne({ where: { brandId: brand.id } });
    if (!carModel) {
      carModel = await Model.create({ name: 'Fortuner', brandId: brand.id });
    }

    let variant = await Variant.findOne({ where: { model_id: carModel.id } });
    if (!variant) {
      variant = await Variant.create({ name: '4x4', model_id: carModel.id });
    }

    // 2. Create a car
    const car = await carService.createCar(seller.id, {
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2023,
      price: 3500000,
      km_driven: 15000,
      fuel_type: 'Diesel',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      status: 'active',
      primary_image: 'fortuner.jpg',
    });

    // 3. Create multiple leads for this car with different sources
    const leadCall1 = await leadService.createLead(buyer.id, {
      car_id: car.id,
      name: 'Buyer One',
      phone: '9777111333',
      source: 'call',
      message: 'Call lead 1',
    });

    const leadCall2 = await leadService.createLead(buyer.id, {
      car_id: car.id,
      name: 'Buyer Two',
      phone: '9777111444',
      source: 'call',
      message: 'Call lead 2',
    });

    const leadWhatsapp = await leadService.createLead(buyer.id, {
      car_id: car.id,
      name: 'Buyer Three',
      phone: '9777111555',
      source: 'whatsapp',
      message: 'WhatsApp enquiry',
    });

    const leadMessage1 = await leadService.createLead(buyer.id, {
      car_id: car.id,
      name: 'Buyer Four',
      phone: '9777111666',
      source: 'message',
      message: 'Message lead 1',
    });

    const leadMessage2 = await leadService.createLead(buyer.id, {
      car_id: car.id,
      name: 'Buyer Five',
      phone: '9777111777',
      source: 'message',
      message: 'Message lead 2',
    });

    // Also add a view and a wishlist
    await carService.recordView(car.id, buyer.id, '127.0.0.1');
    await Wishlist.create({ user_id: buyer.id, car_id: car.id });

    // 4. Mark the car as SOLD
    console.log('Marking car as SOLD...');
    await carService.markCarAsSold(car.id, seller.id);

    // 5. Query Lead Summary with ?status=sold
    console.log('\n--- Checking getLeadSummary(?status=sold) ---');
    const soldSummary = await leadService.getLeadSummary(seller.id, { status: 'sold', limit: 20 });
    console.log('Sold Summary Result:', JSON.stringify(soldSummary, null, 2));

    const soldCarSummary = soldSummary.cars.find(c => c.car_id === car.id);
    if (!soldCarSummary) {
      throw new Error(`Sold car ${car.id} not found in getLeadSummary(?status=sold)!`);
    }

    console.log(`\nSold Car Leads Summary:`);
    console.log(`- total_lead_count: ${soldCarSummary.total_lead_count} (expected 5)`);
    console.log(`- calls: ${soldCarSummary.breakdown.calls} (expected 2)`);
    console.log(`- whatsapp: ${soldCarSummary.breakdown.whatsapp} (expected 1)`);
    console.log(`- messages: ${soldCarSummary.breakdown.messages} (expected 2)`);
    console.log(`- views: ${soldCarSummary.breakdown.views} (expected 1)`);
    console.log(`- wishlist: ${soldCarSummary.breakdown.wishlist} (expected 1)`);

    if (soldCarSummary.total_lead_count !== 5) {
      throw new Error(`Expected total_lead_count to be 5, got ${soldCarSummary.total_lead_count}`);
    }
    if (soldCarSummary.breakdown.calls !== 2) {
      throw new Error(`Expected calls to be 2, got ${soldCarSummary.breakdown.calls}`);
    }
    if (soldCarSummary.breakdown.whatsapp !== 1) {
      throw new Error(`Expected whatsapp to be 1, got ${soldCarSummary.breakdown.whatsapp}`);
    }
    if (soldCarSummary.breakdown.messages !== 2) {
      throw new Error(`Expected messages to be 2, got ${soldCarSummary.breakdown.messages}`);
    }

    console.log('✅ getLeadSummary(?status=sold) correctly returns all lead counts and breakdowns!');

    // 6. Drill-down check on sold car
    console.log('\n--- Checking getCarLeads for sold car ---');
    const drillDown = await leadService.getCarLeads(seller.id, car.id, { limit: 20 });
    console.log(`Drill-down leads count for sold car: ${drillDown.leads.length} (expected 5)`);
    if (drillDown.leads.length !== 5) {
      throw new Error(`Expected drillDown.leads.length to be 5, got ${drillDown.leads.length}`);
    }
    console.log('✅ getCarLeads drill-down for sold car verified!');

    // 7. Dashboard reconciliation check
    console.log('\n--- Checking dashboard reconciliation ---');
    const dashboard = await dashboardService.getDashboardSummary(seller.id, 'dealer');
    console.log('Dashboard summary leads:', dashboard.leads);
    if (dashboard.leads.by_source.call < 2 || dashboard.leads.by_source.whatsapp < 1 || dashboard.leads.by_source.message < 2) {
      throw new Error('Dashboard lead source counts do not match created leads!');
    }
    console.log('✅ Dashboard reconciliation matches lead summary!');

    // Clean up
    await Lead.destroy({ where: { car_id: car.id } });
    await View.destroy({ where: { car_id: car.id } });
    await Wishlist.destroy({ where: { car_id: car.id } });
    await Car.destroy({ where: { id: car.id }, force: true });

    console.log('\n🎉 ALL LEAD SUMMARY SOLD CAR TESTS PASSED 100%!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

testLeadSummarySold();
