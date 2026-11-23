// tests/commercial-views-wishlist-leads.test.js
process.env.NODE_ENV = 'test';

const assert = require('assert');
const viewService = require('../src/services/viewService');
const wishlistService = require('../src/services/wishlistService');
const leadService = require('../src/services/leadService');
const commercialVehicleService = require('../src/services/commercialVehicleService');
const { CommercialVehicle, User, Lead, Wishlist } = require('../src/models');

async function runTests() {
  console.log('--- STARTING COMMERCIAL VEHICLE VIEWS, WISHLIST & LEADS TESTS ---');

  const commercialId = '65e61ad4-54a8-4ae3-a16d-01edf171a182';
  const commercial = await CommercialVehicle.findByPk(commercialId, { paranoid: false });
  assert(commercial, 'Commercial test vehicle must exist');
  const sellerId = commercial.user_id;

  // Find a buyer who is not the seller
  const buyer = await User.findOne({ where: { role: 'customer' } });
  assert(buyer, 'Buyer test user must exist');
  const buyerId = buyer.id;

  // 1. Views Parity & Polymorphic Fallback Test
  console.log('\n[Test 1] Testing Views Parity & Polymorphic Fallback...');
  const carViewsResult = await viewService.getCarViews(sellerId, commercialId, {});
  console.log('CarViews response for commercial vehicle:', {
    vehicle_type: carViewsResult.vehicle_info?.type,
    has_car_info: !!carViewsResult.car_info,
    has_vehicle_info: !!carViewsResult.vehicle_info,
    total_views: carViewsResult.meta?.total_views,
  });

  assert.strictEqual(carViewsResult.vehicle_info.type, 'commercial', 'Must resolve to commercial');
  assert(carViewsResult.car_info, 'car_info must exist for backward compatibility');
  assert(carViewsResult.vehicle_info, 'vehicle_info must exist');
  assert.strictEqual(typeof carViewsResult.meta.total_views, 'number');

  const commViewsResult = await viewService.getCommercialViews(sellerId, commercialId, {});
  assert.strictEqual(commViewsResult.vehicle_info.type, 'commercial');
  console.log('✅ Views Parity passed.');

  // 2. Direct Enquiry Test (Registered user clicks Call/WhatsApp without form)
  console.log('\n[Test 2] Testing Direct Enquiry (Call/WhatsApp without form)...');
  const directCallLead = await leadService.createLead(buyerId, {
    target_id: commercialId,
    source: 'call',
  });
  assert.strictEqual(directCallLead.source, 'call');
  assert.strictEqual(directCallLead.buyer?.phone, buyer.phone);
  console.log('✅ Direct Enquiry passed.');

  // 3. Wishlist Parity & Polymorphic Fallback Test
  console.log('\n[Test 3] Testing Wishlist Parity & Polymorphic Fallback...');
  // Add commercial vehicle to wishlist without specifying target_type
  const addWishlistRes = await wishlistService.addToWishlist(buyerId, commercialId);
  assert.strictEqual(addWishlistRes.is_wishlisted, true);
  console.log('Added commercial vehicle to wishlist without target_type. Count:', addWishlistRes.wishlist_count);

  // Test seller drill-down via getCarWishlists (fallback check)
  const sellerWishlistFallback = await wishlistService.getCarWishlists(sellerId, commercialId, {});
  assert.strictEqual(sellerWishlistFallback.target_type, 'commercial');
  assert(sellerWishlistFallback.car_info, 'car_info must exist');
  assert(sellerWishlistFallback.vehicle_info, 'vehicle_info must exist');
  assert(Array.isArray(sellerWishlistFallback.wishlists));
  console.log('Wishlist seller drill-down via getCarWishlists verified. Total wishlists:', sellerWishlistFallback.total_wishlists);

  // Remove from wishlist
  const removeWishlistRes = await wishlistService.removeFromWishlist(buyerId, commercialId);
  assert.strictEqual(removeWishlistRes.is_wishlisted, false);
  console.log('✅ Wishlist Parity passed.');

  // 4. Leads & WhatsApp Auto-Detection & Drill-down Test
  console.log('\n[Test 4] Testing Leads & WhatsApp Parity...');
  const newLead = await leadService.createLead(buyerId, {
    target_id: commercialId, // No target_type passed - must auto-detect commercial
    source: 'whatsapp',
    message: 'Hi, is this commercial vehicle still available?',
  });

  assert(newLead, 'Lead must be created');
  assert.strictEqual(newLead.target_type, 'commercial');
  assert.strictEqual(newLead.source, 'whatsapp');
  assert.strictEqual(newLead.seller_id, sellerId);
  assert(newLead.vehicle, 'Unified vehicle object must exist');
  assert.strictEqual(newLead.vehicle.target_type, 'commercial');
  console.log('Created WhatsApp lead for commercial vehicle:', {
    lead_id: newLead.id,
    source: newLead.source,
    target_type: newLead.target_type,
    vehicle_name: newLead.vehicle.name,
  });

  // Single Lead Details API Test
  console.log('\n[Test 5] Testing Single Lead Details API...');
  const fetchedLead = await leadService.getLeadById(newLead.id);
  assert(fetchedLead, 'Single lead details must be found');
  assert.strictEqual(fetchedLead.id, newLead.id);
  assert.strictEqual(fetchedLead.target_type, 'commercial');
  assert.strictEqual(fetchedLead.source, 'whatsapp');
  console.log('Fetched single lead details successfully:', {
    id: fetchedLead.id,
    buyer: fetchedLead.buyer?.full_name,
    vehicle: fetchedLead.vehicle?.name,
  });
  console.log('✅ Single Lead Details passed.');

  // Drill-down Leads for Vehicle
  console.log('\n[Test 6] Testing Commercial Leads Drill-Down...');
  const drillDownLeads = await leadService.getCarLeads(sellerId, commercialId, {});
  assert.strictEqual(drillDownLeads.target_type, 'commercial');
  assert(drillDownLeads.car_info, 'car_info must exist');
  assert(drillDownLeads.vehicle_info, 'vehicle_info must exist');
  assert(Array.isArray(drillDownLeads.leads) && drillDownLeads.leads.length > 0);
  const sampleLead = drillDownLeads.leads[0];
  assert(sampleLead.buyer_name, 'buyer_name must exist');
  assert(sampleLead.source, 'source must exist');
  assert(sampleLead.id || sampleLead.lead_id, 'lead id must exist');
  console.log('Sample drill-down lead:', sampleLead);
  console.log('✅ Commercial Leads Drill-Down passed.');

  // Clean up created test leads so DB remains in clean state
  await Lead.destroy({
    where: {
      id: [newLead.id, directCallLead.id],
    },
  });
  const dashboardService = require('../src/services/dashboardService');
  await dashboardService.invalidateDashboardCache(sellerId);
  await dashboardService.invalidateDashboardCache(buyerId);

  console.log('\n🎉 ALL COMMERCIAL VIEWS, WISHLIST & LEADS TESTS PASSED! 🎉');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
