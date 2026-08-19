require('dotenv').config({ override: true });
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, DealerProfile, Brand, Model, Variant, Car, Lead } = require('../src/models');

async function runEnquiriesTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  const assert = (name, condition, detail = '') => {
    if (condition) {
      passed++;
      results.push({ name, status: 'PASSED', detail });
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      failed++;
      results.push({ name, status: 'FAILED', detail });
      console.error(`  ❌ [FAIL] ${name} ${detail ? `-> (${detail})` : ''}`);
    }
  };

  let buyerUser, sellerUser, otherUser, adminUser;
  let buyerToken, sellerToken, otherToken, adminToken;
  let brand, carModel, variant;
  let activeCar, soldCar;
  let createdLeadId = null;

  try {
    await sequelize.authenticate();
    console.log('🔌 Database connected successfully.\n');

    // 1. Setup Test Users
    console.log('👤 Setting up test users (Buyer, Seller, Other, Admin)...');
    const hashedPass = await bcrypt.hash('Secret123!', 10);
    await User.destroy({
      where: {
        email: [
          'enquiry_buyer@test.com',
          'enquiry_seller@test.com',
          'enquiry_other@test.com',
          'enquiry_admin@test.com',
        ],
      },
    });

    buyerUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Buyer Ramesh',
      phone: '9999300001',
      email: 'enquiry_buyer@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    buyerToken = jwt.sign({ id: buyerUser.id, role: buyerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    sellerUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Seller Dealer Suresh',
      phone: '9999300002',
      email: 'enquiry_seller@test.com',
      password_hash: hashedPass,
      role: 'dealer',
      is_verified: true,
    });
    sellerToken = jwt.sign({ id: sellerUser.id, role: sellerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    otherUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Stranger User',
      phone: '9999300003',
      email: 'enquiry_other@test.com',
      password_hash: hashedPass,
      role: 'customer',
      is_verified: true,
    });
    otherToken = jwt.sign({ id: otherUser.id, role: otherUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    adminUser = await User.create({
      id: require('crypto').randomUUID(),
      full_name: 'Platform Admin',
      phone: '9999300004',
      email: 'enquiry_admin@test.com',
      password_hash: hashedPass,
      role: 'admin',
      is_verified: true,
    });
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Setup Brand & Model & Cars
    console.log('🚗 Setting up test cars...');
    brand = await Brand.create({ id: require('crypto').randomUUID(), name: 'Enquiry Test Brand Toyota', logo: 'toyota.png' });
    carModel = await Model.create({ id: require('crypto').randomUUID(), name: 'Fortuner', brandId: brand.id, body_type: 'SUV' });
    variant = await Variant.create({ id: require('crypto').randomUUID(), name: '4x4 AT', model_id: carModel.id });

    activeCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: sellerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2024,
      price: 4200000,
      km_driven: 15000,
      fuel_type: 'Diesel',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'active',
    });

    soldCar = await Car.create({
      id: require('crypto').randomUUID(),
      user_id: sellerUser.id,
      brand_id: brand.id,
      model_id: carModel.id,
      variant_id: variant.id,
      year: 2022,
      price: 3500000,
      km_driven: 35000,
      fuel_type: 'Diesel',
      transmission: 'Automatic',
      ownership: '1st Owner',
      body_type: 'SUV',
      board_type: 'Own Board',
      posted_by_type: 'dealer',
      status: 'sold',
    });

    console.log('\n======================================================');
    console.log('TEST SUITE: ENQUIRY / LEAD MANAGEMENT API');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: POST /api/v1/enquiries - Create Enquiry
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Create Enquiry ---');
    let res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        car_id: activeCar.id,
        message: 'Is this Fortuner still available for test drive?',
        contact_phone: '9876543210',
        preferred_contact: 'whatsapp',
        source: 'message',
      });

    assert('POST /api/v1/enquiries returns 201 Created', res.statusCode === 201, `Status: ${res.statusCode}`);
    assert('Response status is "success"', res.body.status === 'success');
    const leadData = res.body.data;
    createdLeadId = leadData?.id;
    assert('Lead has valid ID', !!createdLeadId);
    assert('Lead status defaults to "new"', leadData?.status === 'new');
    assert('Lead preferred_contact is "whatsapp"', leadData?.preferred_contact === 'whatsapp');
    assert('Lead source is "message"', leadData?.source === 'message');
    assert('Lead message matches sent message', leadData?.message === 'Is this Fortuner still available for test drive?');
    assert('Lead seller_id matches car owner', leadData?.seller_id === sellerUser.id);
    assert('Lead buyer_id matches logged-in user', leadData?.buyer_id === buyerUser.id);
    assert('Lead contains populated car object with brand & model', leadData?.car?.brand === 'Enquiry Test Brand Toyota' && leadData?.car?.model === 'Fortuner');
    assert('Lead contains populated seller object', leadData?.seller?.id === sellerUser.id);
    assert('Lead contains populated buyer object', leadData?.buyer?.id === buyerUser.id);

    // -------------------------------------------------------------------------
    // TEST 2: Validation on Create Enquiry
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Create Enquiry Validation & Edge Cases ---');

    // Missing car_id
    res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ message: 'Missing car id' });
    assert('Missing car_id returns 400 Bad Request', res.statusCode === 400);

    // Non-existent car_id
    const fakeCarId = require('crypto').randomUUID();
    res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: fakeCarId, message: 'Non-existent car' });
    assert('Non-existent car_id returns 404 Not Found', res.statusCode === 404);

    // Enquiring on sold car
    res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: soldCar.id, message: 'Enquiring on sold car' });
    assert('Enquiring on sold car returns 400 Bad Request', res.statusCode === 400);

    // Self-enquiry attempt (Seller enquires on own car)
    res = await request(app)
      .post('/api/v1/enquiries')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ car_id: activeCar.id, message: 'Self enquiry' });
    assert('Self-enquiry attempt returns 400 Bad Request', res.statusCode === 400);

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/v1/enquiries/seller (Seller Enquiries)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: GET /api/v1/enquiries/seller ---');
    res = await request(app)
      .get('/api/v1/enquiries/seller')
      .set('Authorization', `Bearer ${sellerToken}`);

    assert('GET /enquiries/seller returns 200 OK', res.statusCode === 200);
    const sellerLeads = res.body.data?.leads || [];
    assert('Seller leads array has at least 1 lead', sellerLeads.length >= 1);
    const foundLeadForSeller = sellerLeads.find(l => l.id === createdLeadId);
    assert('Created lead exists in seller incoming leads', !!foundLeadForSeller);
    assert('Seller lead has buyer details included', foundLeadForSeller?.buyer?.id === buyerUser.id);
    assert('Seller lead has car details included', foundLeadForSeller?.car?.id === activeCar.id);

    // Other user (not the seller) sees empty seller leads
    res = await request(app)
      .get('/api/v1/enquiries/seller')
      .set('Authorization', `Bearer ${otherToken}`);
    const otherSellerLeads = res.body.data?.leads || [];
    assert('Non-seller user gets 0 seller leads', otherSellerLeads.length === 0);

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/v1/enquiries/me (Buyer Enquiries)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: GET /api/v1/enquiries/me ---');
    res = await request(app)
      .get('/api/v1/enquiries/me')
      .set('Authorization', `Bearer ${buyerToken}`);

    assert('GET /enquiries/me returns 200 OK', res.statusCode === 200);
    const buyerLeads = res.body.data?.leads || [];
    assert('Buyer leads array has at least 1 lead', buyerLeads.length >= 1);
    const foundLeadForBuyer = buyerLeads.find(l => l.id === createdLeadId);
    assert('Created lead exists in buyer outgoing enquiries', !!foundLeadForBuyer);
    assert('Buyer enquiry includes seller details', foundLeadForBuyer?.seller?.id === sellerUser.id);

    // -------------------------------------------------------------------------
    // TEST 5: PATCH /api/v1/enquiries/:id/status (Status Update)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: PATCH /api/v1/enquiries/:id/status ---');

    // Unauthorized update attempt (Buyer or Stranger tries to change status)
    res = await request(app)
      .patch(`/api/v1/enquiries/${createdLeadId}/status`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'contacted' });
    assert('Unauthorized user cannot update lead status (403 Forbidden)', res.statusCode === 403);

    // Seller updates status to 'contacted'
    res = await request(app)
      .patch(`/api/v1/enquiries/${createdLeadId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'contacted' });
    assert('Seller can update status to "contacted" (200 OK)', res.statusCode === 200);
    assert('Updated status is "contacted"', res.body.data?.status === 'contacted');
    assert('read_at timestamp is automatically set', !!res.body.data?.read_at);
    assert('is_viewed is automatically true', res.body.data?.is_viewed === true);

    // Admin updates status to 'closed'
    res = await request(app)
      .patch(`/api/v1/enquiries/${createdLeadId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'closed' });
    assert('Admin can update status to "closed" (200 OK)', res.statusCode === 200);
    assert('Admin updated status is "closed"', res.body.data?.status === 'closed');

    // Invalid status validation
    res = await request(app)
      .patch(`/api/v1/enquiries/${createdLeadId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'invalid_status' });
    assert('Invalid status returns 400 Bad Request', res.statusCode === 400);

    // -------------------------------------------------------------------------
    // TEST 6: GET /api/v1/admin/enquiries (Admin View All Enquiries)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: GET /api/v1/admin/enquiries ---');

    // Non-admin blocked
    res = await request(app)
      .get('/api/v1/admin/enquiries')
      .set('Authorization', `Bearer ${buyerToken}`);
    assert('Non-admin access to admin enquiries returns 403 Forbidden', res.statusCode === 403);

    // Admin access
    res = await request(app)
      .get('/api/v1/admin/enquiries')
      .set('Authorization', `Bearer ${adminToken}`);
    assert('Admin access to admin enquiries returns 200 OK', res.statusCode === 200);
    const adminLeads = res.body.data?.leads || [];
    assert('Admin view contains leads array', Array.isArray(adminLeads));
    assert('Admin view contains created lead', adminLeads.some(l => l.id === createdLeadId));

    // Admin filter by status
    res = await request(app)
      .get('/api/v1/admin/enquiries?status=closed')
      .set('Authorization', `Bearer ${adminToken}`);
    assert('Admin filter by status=closed returns 200 OK', res.statusCode === 200);
    const closedLeads = res.body.data?.leads || [];
    assert('Filtered leads have status "closed"', closedLeads.every(l => l.status === 'closed'));

    // -------------------------------------------------------------------------
    // TEST 7: /api/v1/leads mount compatibility
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: /api/v1/leads Alias Compatibility ---');
    res = await request(app)
      .get('/api/v1/leads/seller')
      .set('Authorization', `Bearer ${sellerToken}`);
    assert('GET /api/v1/leads/seller returns 200 OK', res.statusCode === 200);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n======================================================');
    console.log('ENQUIRY / LEAD MANAGEMENT TEST SUMMARY');
    console.log('======================================================');
    console.log(`Total Assertions: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Unexpected error during test run:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test leads, cars, brand, model, and users...');
    try {
      if (createdLeadId) {
        await Lead.destroy({ where: { id: createdLeadId } });
      }
      if (activeCar) await Car.unscoped().destroy({ where: { id: activeCar.id } });
      if (soldCar) await Car.unscoped().destroy({ where: { id: soldCar.id } });
      if (variant) await variant.destroy();
      if (carModel) await carModel.destroy();
      if (brand) await brand.destroy();
      if (buyerUser) await buyerUser.destroy();
      if (sellerUser) await sellerUser.destroy();
      if (otherUser) await otherUser.destroy();
      if (adminUser) await adminUser.destroy();
      console.log('✅ Cleanup complete.');
    } catch (cleanErr) {
      console.error('⚠️ Cleanup warning:', cleanErr.message);
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runEnquiriesTests();
