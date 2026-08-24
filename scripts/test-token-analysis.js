const jwt = require('jsonwebtoken');
const sequelize = require('../src/config/database');
const { User, Car, Lead } = require('../src/models');
const dashboardService = require('../src/services/dashboardService');
const leadService = require('../src/services/leadService');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImMxNTA0ODMxLTkwYjQtNGFjMi1iNzkzLTZmMTAyNjJhMWU1NSIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NzU1MzcyOCwiZXhwIjoxNzg5MjgxNzI4fQ.YgWg0A9OOAudgbJvgeXP3Gb5xMW-bjt2tIprS5hVRc4';

async function analyzeUserToken() {
  console.log('🔍 ANALYZING TOKEN & DATA FOR USER PROFILE...\n');

  const decoded = jwt.decode(token);
  console.log('Decoded Token:', decoded);

  const userId = decoded.id;
  const user = await User.findByPk(userId);
  console.log('\nUser Info:');
  console.log(`- ID: ${user.id}`);
  console.log(`- Name: ${user.full_name}`);
  console.log(`- Role: ${user.role}`);
  console.log(`- Phone: ${user.phone}`);

  // 1. Cars owned by this user
  const cars = await Car.unscoped().findAll({ where: { user_id: userId } });
  console.log(`\nCars owned by user (${cars.length}):`);
  cars.forEach(c => {
    console.log(`- Car ID: ${c.id}, Status: ${c.status}, Number Plate: ${c.number_plate}`);
  });

  // 2. Leads received ON this user's cars (as Seller)
  const carIds = cars.map(c => c.id);
  const leadsOnUserCars = carIds.length ? await Lead.findAll({ where: { car_id: carIds } }) : [];
  console.log(`\nLeads received ON user's cars as Seller: ${leadsOnUserCars.length}`);

  // 3. Leads sent BY this user to OTHER cars (as Buyer)
  const leadsSentByUser = await Lead.findAll({
    where: { buyer_id: userId },
    include: [{ model: Car.unscoped(), as: 'car' }]
  });
  console.log(`\nEnquiries sent BY user to other sellers as Buyer: ${leadsSentByUser.length}`);
  leadsSentByUser.forEach((l, i) => {
    console.log(`  ${i + 1}. [${l.source.toUpperCase()}] on Car ID: ${l.car_id} (Car Status: ${l.car?.status}, Seller ID: ${l.seller_id})`);
  });

  // 4. Dashboard response
  console.log('\n--- GET /api/v1/users/me/dashboard ---');
  const dash = await dashboardService.getDashboardSummary(userId, user.role);
  console.log(JSON.stringify(dash, null, 2));

  // 5. Lead Summary response
  console.log('\n--- GET /api/v1/leads/summary?status=sold ---');
  const soldSummary = await leadService.getLeadSummary(userId, { status: 'sold' });
  console.log(JSON.stringify(soldSummary, null, 2));

  // 6. Buyer leads response (GET /api/v1/leads/me)
  console.log('\n--- GET /api/v1/leads/me (Buyer Enquiries) ---');
  const buyerLeads = await leadService.getBuyerLeads(userId, {});
  console.log(`Total Buyer Enquiries: ${buyerLeads.total}`);
  console.log(`Sample Enquiries:`, buyerLeads.leads.slice(0, 2).map(l => ({
    type: l.type,
    car_name: l.car?.name,
    car_price: l.car?.price,
    seller_name: l.car?.seller?.full_name,
    created_at: l.created_at
  })));

  process.exit(0);
}

analyzeUserToken().catch(e => {
  console.error(e);
  process.exit(1);
});
