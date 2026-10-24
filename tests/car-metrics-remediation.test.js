'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_BULL_IN_DEV = 'true';

const sequelize = require('../src/config/database');
const { Car, User, Wishlist, View, Lead, CarStat } = require('../src/models');
const wishlistService = require('../src/services/wishlistService');
const carService = require('../src/services/carService');
const leadService = require('../src/services/leadService');
const analyticsService = require('../src/services/analyticsService');

describe('Car Metrics Remediation Suite (W-01 to S-04)', () => {
  let testCar;
  let testSeller;
  let testUserA;
  let testUserB;

  beforeAll(async () => {
    await sequelize.authenticate();

    const genPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString();

    // Create or find a test seller
    testSeller = await User.create({
      full_name: 'Test Seller Metrics',
      phone: genPhone(),
      email: `seller_${Date.now()}@test.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'dealer',
      is_verified: true,
    });

    // Create two test users for buyer interactions
    testUserA = await User.create({
      full_name: 'Buyer User A',
      phone: genPhone(),
      email: `buyerA_${Date.now()}@test.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'customer',
      is_verified: true,
    });

    testUserB = await User.create({
      full_name: 'Buyer User B',
      phone: genPhone(),
      email: `buyerB_${Date.now()}@test.com`,
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'customer',
      is_verified: true,
    });

    // Pick an existing valid active car and its seller from the database
    testCar = await Car.findOne({ where: { status: 'active' } });
    if (!testCar) {
      throw new Error('No active car found in database for testing');
    }

    testSeller = await User.findByPk(testCar.user_id);

    // Clean any prior interactions for testCar to start with a clean slate
    await View.destroy({ where: { car_id: testCar.id } });
    await Wishlist.destroy({ where: { car_id: testCar.id } });
    await Lead.destroy({ where: { car_id: testCar.id } });
    await CarStat.destroy({ where: { car_id: testCar.id } });

    // Reconcile initial state
    await analyticsService.reconcileCarStats([testCar.id]);
  });

  afterAll(async () => {
    if (testCar) {
      await View.destroy({ where: { car_id: testCar.id } });
      await Wishlist.destroy({ where: { car_id: testCar.id } });
      await Lead.destroy({ where: { car_id: testCar.id } });
      await analyticsService.reconcileCarStats([testCar.id]);
    }
    if (testUserA) await testUserA.destroy();
    if (testUserB) await testUserB.destroy();
  });

  describe('A. Wishlist Counter Invariants (W-01 to W-05)', () => {
    test('W-01: Add then remove returns to 0 on both live table and car_stats', async () => {
      // Add
      await wishlistService.toggleWishlist(testUserA.id, testCar.id);
      let rowCount = await Wishlist.count({ where: { car_id: testCar.id } });
      let stat = await CarStat.findOne({ where: { car_id: testCar.id } });
      expect(rowCount).toBe(1);
      expect(stat.wishlist_count).toBe(1);

      // Remove
      await wishlistService.toggleWishlist(testUserA.id, testCar.id);
      rowCount = await Wishlist.count({ where: { car_id: testCar.id } });
      stat = await CarStat.findOne({ where: { car_id: testCar.id } });
      expect(rowCount).toBe(0);
      expect(stat.wishlist_count).toBe(0);
    });

    test('W-02 & W-05: Multi-user add and remove keeps parity, no Math.max masking', async () => {
      // User A and User B add
      await wishlistService.addToWishlist(testUserA.id, testCar.id);
      await wishlistService.addToWishlist(testUserB.id, testCar.id);
      let stat = await CarStat.findOne({ where: { car_id: testCar.id } });
      expect(stat.wishlist_count).toBe(2);

      // User A removes
      await wishlistService.removeFromWishlist(testUserA.id, testCar.id);
      const rowCount = await Wishlist.count({ where: { car_id: testCar.id } });
      stat = await CarStat.findOne({ where: { car_id: testCar.id } });
      expect(rowCount).toBe(1);
      expect(stat.wishlist_count).toBe(1);

      // Verify getCarById reads live truth (1)
      const detail = await carService.getCarById(testCar.id, testUserA.id);
      expect(detail.wishlist_count).toBe(1);

      // Cleanup User B
      await wishlistService.removeFromWishlist(testUserB.id, testCar.id);
    });

    test('W-04: Floor guard prevents negative counter', async () => {
      // Ensure counter is 0
      await CarStat.update({ wishlist_count: 0 }, { where: { car_id: testCar.id } });

      // Call decrement directly
      await analyticsService.decrementInteraction({ carId: testCar.id, type: 'wishlist' });
      const stat = await CarStat.findOne({ where: { car_id: testCar.id } });
      expect(stat.wishlist_count).toBe(0);
    });
  });

  describe('B. Views Counter Invariants (V-01 to V-04)', () => {
    test('V-01 & V-02: View records once and repeat view does not inflate view count', async () => {
      const initialViews = (await View.count({ where: { car_id: testCar.id } })) || 0;

      // First view
      await carService.recordView(testCar.id, testUserA.id);
      let viewsAfterFirst = await View.count({ where: { car_id: testCar.id } });
      expect(viewsAfterFirst).toBe(initialViews + 1);

      // Repeat view by same user
      await carService.recordView(testCar.id, testUserA.id);
      let viewsAfterRepeat = await View.count({ where: { car_id: testCar.id } });
      expect(viewsAfterRepeat).toBe(initialViews + 1); // Not inflated
    });

    test('V-03: Anonymous (guest) view records with user_id=null', async () => {
      const initialViews = await View.count({ where: { car_id: testCar.id } });
      await carService.recordView(testCar.id, null);
      const afterViews = await View.count({ where: { car_id: testCar.id } });
      expect(afterViews).toBe(initialViews + 1);
    });
  });

  describe('C. Leads / Enquiries Invariants (L-01 to L-05)', () => {
    test('L-01 to L-05: Mixed sources sum cleanly and total_lead_count equals sum of breakdown', async () => {
      // Clear existing leads for testCar
      await Lead.destroy({ where: { car_id: testCar.id } });

      // 1 Call lead
      await leadService.createLead(testUserA.id, {
        car_id: testCar.id,
        source: 'call',
        message: 'Call lead test',
      });

      // 1 WhatsApp lead
      await leadService.createLead(testUserB.id, {
        car_id: testCar.id,
        source: 'whatsapp',
        message: 'WhatsApp lead test',
      });

      // 1 Message lead
      await leadService.createLead(testUserA.id, {
        car_id: testCar.id,
        source: 'message',
        message: 'Message lead test',
      });

      const summary = await leadService.getLeadSummary(testSeller.id);
      const carSummary = summary.cars.find(c => c.car_id === testCar.id);
      expect(carSummary).toBeDefined();

      const { calls, whatsapp, messages, enquiries } = carSummary.breakdown;
      expect(calls).toBe(1);
      expect(whatsapp).toBe(1);
      expect(messages).toBe(1);
      expect(enquiries).toBe(0); // No non-call/whatsapp/message enquiry
      expect(carSummary.total_lead_count).toBe(3);
      expect(calls + whatsapp + messages + enquiries).toBe(carSummary.total_lead_count);
    });
  });

  describe('D. Stats Backfill & Self-Healing (S-01 to S-04)', () => {
    test('S-01: ensureCarStats backfills missing row from live base tables', async () => {
      // Temporarily delete car_stats row for testCar
      await CarStat.destroy({ where: { car_id: testCar.id } });
      expect(await CarStat.count({ where: { car_id: testCar.id } })).toBe(0);

      // Calling ensureCarStats self-heals
      const healed = await analyticsService.ensureCarStats(testCar.id);
      expect(healed).toBeDefined();
      expect(healed.car_id).toBe(testCar.id);

      const dbRows = await CarStat.count({ where: { car_id: testCar.id } });
      expect(dbRows).toBe(1);
    });

    test('S-03 & S-04: reconcileCarStats produces 0 drift on clean database', async () => {
      const reconcile = await analyticsService.reconcileCarStats([testCar.id]);
      expect(reconcile.drifts.length).toBe(0);
    });
  });
});
