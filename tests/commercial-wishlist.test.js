const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const redisClient = require('../src/config/redis');
const {
  User,
  Car,
  CarImage,
  Brand,
  Model,
  Variant,
  VehicleType,
  CommercialVehicle,
  CommercialVehicleImage,
  Wishlist,
  State,
  District,
  City,
} = require('../src/models');

const makePhone = (prefix) => {
  const rand = `${Math.floor(1000000 + Math.random() * 8999999)}`;
  const ts = `${Date.now()}`.slice(-2);
  return `${prefix}${ts}${rand}`;
};

describe('Commercial Vehicle Wishlist Integration Tests', () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let sellerUser;
  let buyerUser;
  let otherUser;
  let sellerToken;
  let buyerToken;
  let otherToken;

  let testBrand;
  let testModel;
  let testVariant;
  let testVehicleType;
  let testState;
  let testDistrict;
  let testCity;

  let testCar;
  let activeCommercial;
  let soldCommercial;

  beforeAll(async () => {
    testState = await State.findOne({ where: { name: 'Tamil Nadu' } });
    testDistrict = await District.findOne({ where: { state_id: testState.id } });
    testCity = await City.findOne({ where: { district_id: testDistrict.id } });

    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    sellerUser = await User.create({
      full_name: `WL Seller ${suffix}`,
      phone: makePhone('9'),
      email: `wlseller_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    buyerUser = await User.create({
      full_name: `WL Buyer ${suffix}`,
      phone: makePhone('8'),
      email: `wlbuyer_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    otherUser = await User.create({
      full_name: `WL Other ${suffix}`,
      phone: makePhone('7'),
      email: `wlother_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    sellerToken = jwt.sign({ id: sellerUser.id, role: sellerUser.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    buyerToken = jwt.sign({ id: buyerUser.id, role: buyerUser.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    otherToken = jwt.sign({ id: otherUser.id, role: otherUser.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    testBrand = await Brand.create({
      name: `WLBrand_${suffix}`,
      slug: `wl-brand-${suffix}`,
      is_active: true,
    });

    testModel = await Model.create({
      name: `WLModel_${suffix}`,
      brandId: testBrand.id,
      body_type: 'Sedan',
      is_active: true,
    });

    testVariant = await Variant.create({
      name: `WLVariant_${suffix}`,
      model_id: testModel.id,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      is_active: true,
    });

    testVehicleType = await VehicleType.create({
      name: `WLType_${suffix}`.slice(0, 45),
      slug: `wl-type-${suffix}`.slice(0, 65),
      order: 998,
      is_active: true,
    });

    testCar = await Car.create({
      user_id: sellerUser.id,
      brand_id: testBrand.id,
      model_id: testModel.id,
      variant_id: testVariant.id,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
      year: 2022,
      price: 550000,
      km_driven: 18000,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      ownership: '1st Owner',
      body_type: 'Sedan',
      board_type: 'Own Board',
      posted_by_type: 'customer',
      status: 'active',
      description: `Test wishlist car ${suffix}`,
      color: 'White',
      number_plate: 'TN38AB1234',
    });

    await CarImage.create({
      car_id: testCar.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
      is_primary: true,
      sort_order: 0,
    });

    activeCommercial = await CommercialVehicle.create({
      user_id: sellerUser.id,
      vehicle_type_id: testVehicleType.id,
      brand_id: testBrand.id,
      year: 2023,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      km_driven: 42000,
      price: 1250000,
      description: `Active commercial truck ${suffix}`,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
      posted_by_type: 'customer',
      status: 'active',
      slug: `wl-active-commercial-${suffix}`,
    });

    await CommercialVehicleImage.create({
      commercial_vehicle_id: activeCommercial.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/v1/truck_sample.jpg',
      is_primary: true,
      sort_order: 0,
    });

    soldCommercial = await CommercialVehicle.create({
      user_id: sellerUser.id,
      vehicle_type_id: testVehicleType.id,
      brand_id: testBrand.id,
      year: 2020,
      fuel_type: 'Diesel',
      ownership: '2nd Owner',
      km_driven: 85000,
      price: 820000,
      description: `Sold commercial truck ${suffix}`,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
      posted_by_type: 'customer',
      status: 'sold',
      slug: `wl-sold-commercial-${suffix}`,
    });
  });

  afterAll(async () => {
    const userIds = [sellerUser?.id, buyerUser?.id, otherUser?.id].filter(Boolean);
    const commercialIds = [activeCommercial?.id, soldCommercial?.id].filter(Boolean);
    const carIds = [testCar?.id].filter(Boolean);

    if (userIds.length > 0) {
      await Wishlist.destroy({ where: { user_id: userIds } });
    }
    if (commercialIds.length > 0) {
      await CommercialVehicleImage.destroy({ where: { commercial_vehicle_id: commercialIds } });
      await CommercialVehicle.destroy({ where: { id: commercialIds }, force: true });
    }
    if (carIds.length > 0) {
      await CarImage.destroy({ where: { car_id: carIds } });
      await Car.destroy({ where: { id: carIds }, force: true });
    }
    if (testVariant?.id) await Variant.destroy({ where: { id: testVariant.id } });
    if (testModel?.id) await Model.destroy({ where: { id: testModel.id } });
    if (testVehicleType?.id) await VehicleType.destroy({ where: { id: testVehicleType.id } });
    if (testBrand?.id) await Brand.destroy({ where: { id: testBrand.id } });
    if (userIds.length > 0) await User.destroy({ where: { id: userIds } });
  });

  describe('Validation Rules', () => {
    it('rejects invalid target_type on POST /api/v1/wishlist', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_id: activeCommercial.id, target_type: 'bike' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing target identifier on POST /api/v1/wishlist/toggle', async () => {
      const res = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_type: 'commercial' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid target_type query param on GET /api/v1/wishlist', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist?target_type=invalid')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid target_type on DELETE /api/v1/wishlist/:carId', async () => {
      const res = await request(app)
        .delete(`/api/v1/wishlist/${activeCommercial.id}?target_type=invalid`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Add & Toggle Commercial Wishlist', () => {
    it('blocks adding a non-active (sold) commercial vehicle via POST and toggle', async () => {
      const postRes = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_type: 'commercial', target_id: soldCommercial.id });

      expect(postRes.status).toBe(400);

      const toggleRes = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_type: 'commercial', target_id: soldCommercial.id });

      expect(toggleRes.status).toBe(400);
    });

    it('adds a car and an active commercial vehicle to wishlist', async () => {
      const carRes = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ car_id: testCar.id, target_type: 'car' });

      expect(carRes.status).toBe(200);
      expect(carRes.body.success).toBe(true);

      const commercialRes = await request(app)
        .post('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_id: activeCommercial.id, target_type: 'commercial' });

      expect(commercialRes.status).toBe(200);
      expect(commercialRes.body.success).toBe(true);
      expect(commercialRes.body.data.target_type).toBe('commercial');
      expect(commercialRes.body.data.target_id).toBe(activeCommercial.id);
    });

    it('toggles a commercial vehicle off and back on cleanly', async () => {
      const offRes = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_id: activeCommercial.id, target_type: 'commercial' });

      expect(offRes.status).toBe(200);
      expect(offRes.body.is_wishlisted).toBe(false);

      const onRes = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ target_id: activeCommercial.id, target_type: 'commercial' });

      expect(onRes.status).toBe(200);
      expect(onRes.body.is_wishlisted).toBe(true);
    });
  });

  describe('Read Operations & Backward Compatibility Safeguard', () => {
    it('GET /api/v1/wishlist (no params) strictly returns ONLY car items and excludes commercial items', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const ids = res.body.data.map((item) => item.id);
      expect(ids).toContain(testCar.id);
      expect(ids).not.toContain(activeCommercial.id);
      expect(res.body.data.every((item) => item.target_type === 'car')).toBe(true);

      const carItem = res.body.data.find((item) => item.id === testCar.id);
      expect(carItem.isWishlist).toBe(true);
      expect(Array.isArray(carItem.images)).toBe(true);
    });

    it('GET /api/v1/wishlist?target_type=commercial returns ONLY commercial items formatted via transformCommercialVehicleImages', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist?target_type=commercial')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);

      const item = res.body.data[0];
      expect(item.id).toBe(activeCommercial.id);
      expect(item.target_type).toBe('commercial');
      expect(item.target_id).toBe(activeCommercial.id);
      expect(item.isWishlist).toBe(true);
      expect(item.wishlist_count).toBeGreaterThanOrEqual(1);
      expect(item.primary_image).toBeTruthy();
      expect(item.brandName).toBe(testBrand.name);
      expect(item.vehicleTypeName).toBe(testVehicleType.name);
      // Verify seller PII masking for non-owner buyer
      expect(item.seller).toBeDefined();
      expect(item.seller.phone).not.toBe(sellerUser.phone);
      expect(item.seller.phone).toMatch(/^\*+/);
      expect(item.seller.email).toBeNull();
    });

    it('GET /api/v1/wishlist?target_type=all returns BOTH car and commercial items tagged with target_type', async () => {
      const res = await request(app)
        .get('/api/v1/wishlist?target_type=all')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const carEntry = res.body.data.find((i) => i.id === testCar.id);
      const commEntry = res.body.data.find((i) => i.id === activeCommercial.id);

      expect(carEntry).toBeDefined();
      expect(carEntry.target_type).toBe('car');
      expect(commEntry).toBeDefined();
      expect(commEntry.target_type).toBe('commercial');
    });
  });

  describe('Commercial Wishlist Counts & Seller Viewer Endpoints', () => {
    it('reflects accurate wishlist_count on listing, detail, and /me endpoints', async () => {
      // Have a second buyer wishlist the same commercial vehicle
      const secondToggle = await request(app)
        .post('/api/v1/wishlist/toggle')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_id: activeCommercial.id, target_type: 'commercial' });

      expect(secondToggle.status).toBe(200);
      expect(secondToggle.body.is_wishlisted).toBe(true);

      const detailRes = await request(app)
        .get(`/api/v1/commercial/${activeCommercial.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.isWishlist).toBe(true);
      expect(detailRes.body.data.wishlist_count).toBe(2);

      const listRes = await request(app)
        .get(`/api/v1/commercial?brand_id=${testBrand.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(listRes.status).toBe(200);
      const listedItem = listRes.body.data.vehicles.find((v) => v.id === activeCommercial.id);
      expect(listedItem).toBeDefined();
      expect(listedItem.isWishlist).toBe(true);
      expect(listedItem.wishlist_count).toBe(2);

      const meRes = await request(app)
        .get('/api/v1/commercial/me')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(meRes.status).toBe(200);
      const myItem = meRes.body.data.vehicles.find((v) => v.id === activeCommercial.id);
      expect(myItem).toBeDefined();
      expect(myItem.wishlist_count).toBe(2);
    });

    it('allows seller to view masked buyer phones on GET /api/v1/wishlist/commercial/:commercialId and blocks non-owners', async () => {
      const forbiddenRes = await request(app)
        .get(`/api/v1/wishlist/commercial/${activeCommercial.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(forbiddenRes.status).toBe(403);

      const ownerRes = await request(app)
        .get(`/api/v1/wishlist/commercial/${activeCommercial.id}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.status).toBe('success');
      expect(ownerRes.body.data.total_wishlists).toBe(2);
      expect(ownerRes.body.data.wishlists.length).toBe(2);

      ownerRes.body.data.wishlists.forEach((entry) => {
        expect(entry.user_phone).toMatch(/^\*{6}\d{4}$/);
        expect(entry.user_phone).not.toBe(buyerUser.phone);
        expect(entry.user_phone).not.toBe(otherUser.phone);
      });
    });

    it('preserves seller ownership checks and masking on GET /api/v1/wishlist/car/:carId', async () => {
      const forbiddenRes = await request(app)
        .get(`/api/v1/wishlist/car/${testCar.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(forbiddenRes.status).toBe(403);

      const ownerRes = await request(app)
        .get(`/api/v1/wishlist/car/${testCar.id}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.data.total_wishlists).toBe(1);
      expect(ownerRes.body.data.wishlists[0].user_phone).toBe(`******${buyerUser.phone.slice(-4)}`);
    });
  });

  describe('Delete & Redis Cache Invalidation', () => {
    it('deletes commercial wishlist via query param and invalidates Redis caches on add & delete', async () => {
      const commercialDetailKey = `commercial:${activeCommercial.id}`;
      const commercialWishlistsKey = `commercial:wishlists:${activeCommercial.id}:first:20`;
      const expressCommercialKey = `__express__/api/v1/commercial/${activeCommercial.id}?test=${suffix}`;
      const buyerWishlistKey = `wishlist:user:${buyerUser.id}:commercial`;

      // Seed keys directly when Redis is open, or spy on del/scanIterator when Redis is offline in test env
      const deletedKeys = [];
      let restoreRedisMocks = null;

      if (redisClient.isOpen) {
        await Promise.all([
          redisClient.set(commercialDetailKey, JSON.stringify({ cached: true }), { EX: 60 }),
          redisClient.set(commercialWishlistsKey, JSON.stringify({ cached: true }), { EX: 60 }),
          redisClient.set(expressCommercialKey, JSON.stringify({ cached: true }), { EX: 60 }),
          redisClient.set(buyerWishlistKey, JSON.stringify({ cached: true }), { EX: 60 }),
        ]);
      } else {
        const origIsOpenDesc = Object.getOwnPropertyDescriptor(redisClient, 'isOpen');
        Object.defineProperty(redisClient, 'isOpen', { get: () => true, configurable: true });
        const delSpy = jest.spyOn(redisClient, 'del').mockImplementation(async (keys) => {
          if (Array.isArray(keys)) deletedKeys.push(...keys);
          else if (keys) deletedKeys.push(keys);
          return 1;
        });
        const scanSpy = jest.spyOn(redisClient, 'scanIterator').mockImplementation(async function* ({ MATCH }) {
          if (MATCH === '__express__/api/v1/commercial*') yield expressCommercialKey;
          if (MATCH === `commercial:wishlists:${activeCommercial.id}:*`) yield commercialWishlistsKey;
          if (MATCH === `wishlist:user:${buyerUser.id}:*`) yield buyerWishlistKey;
        });
        restoreRedisMocks = () => {
          delSpy.mockRestore();
          scanSpy.mockRestore();
          if (origIsOpenDesc) {
            Object.defineProperty(redisClient, 'isOpen', origIsOpenDesc);
          } else {
            delete redisClient.isOpen;
          }
        };
      }

      try {
        // Delete via query param (req.query.target_type = 'commercial')
        const delRes = await request(app)
          .delete(`/api/v1/wishlist/${activeCommercial.id}?target_type=commercial`)
          .set('Authorization', `Bearer ${buyerToken}`);

        expect(delRes.status).toBe(200);
        expect(delRes.body.success).toBe(true);

        if (redisClient.isOpen && !restoreRedisMocks) {
          const [detailVal, wlVal, expressVal, buyerVal] = await Promise.all([
            redisClient.get(commercialDetailKey),
            redisClient.get(commercialWishlistsKey),
            redisClient.get(expressCommercialKey),
            redisClient.get(buyerWishlistKey),
          ]);
          expect(detailVal).toBeNull();
          expect(wlVal).toBeNull();
          expect(expressVal).toBeNull();
          expect(buyerVal).toBeNull();

          // Re-seed and test cache invalidation on commercial add as well
          await Promise.all([
            redisClient.set(commercialDetailKey, JSON.stringify({ cached: true }), { EX: 60 }),
            redisClient.set(expressCommercialKey, JSON.stringify({ cached: true }), { EX: 60 }),
          ]);

          const reAddRes = await request(app)
            .post('/api/v1/wishlist')
            .set('Authorization', `Bearer ${buyerToken}`)
            .send({ target_id: activeCommercial.id, target_type: 'commercial' });

          expect(reAddRes.status).toBe(200);
          expect(await redisClient.get(commercialDetailKey)).toBeNull();
          expect(await redisClient.get(expressCommercialKey)).toBeNull();

          // Clean back up via DELETE query
          await request(app)
            .delete(`/api/v1/wishlist/${activeCommercial.id}?target_type=commercial`)
            .set('Authorization', `Bearer ${buyerToken}`);
        } else {
          expect(deletedKeys).toContain(commercialDetailKey);
          expect(deletedKeys).toContain(commercialWishlistsKey);
          expect(deletedKeys).toContain(expressCommercialKey);
          expect(deletedKeys).toContain(buyerWishlistKey);
        }
      } finally {
        if (restoreRedisMocks) restoreRedisMocks();
      }

      // Confirm buyer's car wishlist entry remained intact while commercial entry was deleted
      const remainingCarWl = await request(app)
        .get('/api/v1/wishlist')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(remainingCarWl.status).toBe(200);
      expect(remainingCarWl.body.data.map((i) => i.id)).toContain(testCar.id);

      const remainingCommWl = await request(app)
        .get('/api/v1/wishlist?target_type=commercial')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(remainingCommWl.status).toBe(200);
      expect(remainingCommWl.body.data.length).toBe(0);

      // Delete second buyer's commercial wishlist via req.body
      const bodyDelRes = await request(app)
        .delete(`/api/v1/wishlist/${activeCommercial.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_type: 'commercial' });

      expect(bodyDelRes.status).toBe(200);

      // Verify count drops back to 0
      const finalDetail = await request(app)
        .get(`/api/v1/commercial/${activeCommercial.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(finalDetail.status).toBe(200);
      expect(finalDetail.body.data.wishlist_count).toBe(0);
      expect(finalDetail.body.data.isWishlist).toBe(false);
    });
  });
});

