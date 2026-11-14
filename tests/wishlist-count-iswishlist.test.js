const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const redisClient = require('../src/config/redis');
const {
  User,
  DealerProfile,
  Car,
  CarImage,
  Brand,
  Model,
  Variant,
  CarType,
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

describe('Wishlist Count & isWishlist Resolution Tests', () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let dealerUser;
  let buyerUser;
  let dealerToken;
  let buyerToken;

  let testBrand;
  let testModel;
  let testVariant;
  let testVehicleType;
  let testState;
  let testDistrict;
  let testCity;

  let testDealerCar;
  let testCommercial;

  beforeAll(async () => {
    testState = await State.findOne({ where: { name: 'Tamil Nadu' } });
    testDistrict = await District.findOne({ where: { state_id: testState.id } });
    testCity = await City.findOne({ where: { district_id: testDistrict.id } });

    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    // Create a Dealer user
    dealerUser = await User.create({
      full_name: `WL Dealer ${suffix}`,
      phone: makePhone('9'),
      email: `wldealer_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'dealer',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    await DealerProfile.create({
      user_id: dealerUser.id,
      company_name: `Auto Deal ${suffix}`,
      door_no: '12A',
      building_name: 'Plaza Tower',
      street_name: '123 Main Road',
      pincode: '600001',
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    // Create a Buyer user
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

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
    dealerToken = jwt.sign({ id: dealerUser.id, role: dealerUser.role }, jwtSecret, { expiresIn: '1h' });
    buyerToken = jwt.sign({ id: buyerUser.id, role: buyerUser.role }, jwtSecret, { expiresIn: '1h' });

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

    testVehicleType = await CarType.findOne() || await CarType.create({
      name: `WLType_${suffix}`.slice(0, 45),
      slug: `wl-type-${suffix}`.slice(0, 65),
      order: 998,
      is_active: true,
    });

    // Create a Car for dealer with 0 wishlists initially
    testDealerCar = await Car.create({
      user_id: dealerUser.id,
      brand_id: testBrand.id,
      model_id: testModel.id,
      variant_id: testVariant.id,
      year: 2022,
      price: 650000,
      km_driven: 32000,
      fuel_type: 'petrol',
      transmission: 'manual',
      body_type: 'hatchback',
      ownership: '1st Owner',
      posted_by_type: 'dealer',
      status: 'active',
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    await CarImage.create({
      car_id: testDealerCar.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      is_primary: true,
    });

    // Create an active Commercial Vehicle
    testCommercial = await CommercialVehicle.create({
      user_id: dealerUser.id,
      brand_id: testBrand.id,
      vehicle_type_id: testVehicleType.id,
      title: `Commercial Tata Ace ${suffix}`,
      year: 2021,
      price: 450000,
      km_driven: 50000,
      fuel_type: 'diesel',
      transmission: 'manual',
      ownership: '1st Owner',
      posted_by_type: 'dealer',
      slug: `commercial-tata-ace-${suffix}`,
      status: 'active',
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    await CommercialVehicleImage.create({
      commercial_vehicle_id: testCommercial.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      is_primary: true,
      sort_order: 0,
    });
  });

  afterAll(async () => {
    // Cleanup
    await Wishlist.destroy({ where: { user_id: [dealerUser?.id, buyerUser?.id].filter(Boolean) } });
    if (testDealerCar) {
      await CarImage.destroy({ where: { car_id: testDealerCar.id } });
      await testDealerCar.destroy({ force: true });
    }
    if (testCommercial) {
      await CommercialVehicleImage.destroy({ where: { commercial_vehicle_id: testCommercial.id } });
      await testCommercial.destroy({ force: true });
    }
    if (dealerUser) {
      await DealerProfile.destroy({ where: { user_id: dealerUser.id } });
      await dealerUser.destroy({ force: true });
    }
    if (buyerUser) {
      await buyerUser.destroy({ force: true });
    }
    if (testVariant) {
      await testVariant.destroy({ force: true });
    }
    if (testModel) {
      await testModel.destroy({ force: true });
    }
    if (testBrand) {
      await testBrand.destroy({ force: true });
    }
  });

  test('1. Dealer Cars: GET /api/v1/dealers/:id/cars returns wishlist_count = 0 (never null) and isWishlist = false', async () => {
    const res = await request(app)
      .get(`/api/v1/dealers/${dealerUser.id}/cars`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.cars)).toBe(true);

    const car = res.body.data.cars.find((c) => c.id === testDealerCar.id);
    expect(car).toBeDefined();
    expect(car.wishlist_count).toBe(0);
    expect(car.wishlist_count).not.toBeNull();
    expect(car.isWishlist).toBe(false);
    expect(car.is_wishlist).toBe(false);
  });

  test('2. User Cars: GET /api/v1/cars/me returns wishlist_count = 0 (never null) on root and metrics', async () => {
    const res = await request(app)
      .get('/api/v1/cars/me')
      .set('Authorization', `Bearer ${dealerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.cars)).toBe(true);

    const car = res.body.data.cars.find((c) => c.id === testDealerCar.id);
    expect(car).toBeDefined();
    expect(car.wishlist_count).toBe(0);
    expect(car.wishlist_count).not.toBeNull();
    expect(car.metrics?.wishlist_count).toBe(0);
    expect(car.isWishlist).toBe(false);
    expect(car.is_wishlist).toBe(false);
  });

  test('3. Commercial Wishlist: Toggle adds item, updates wishlist_count, sets isWishlist = true', async () => {
    // Before toggle: verify commercial vehicle has 0 wishlists
    const beforeRes = await request(app)
      .get(`/api/v1/commercial/${testCommercial.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.data.wishlist_count).toBe(0);
    expect(beforeRes.body.data.isWishlist).toBe(false);

    // Toggle on
    const toggleRes = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.success).toBe(true);
    expect(toggleRes.body.isWishlist).toBe(true);
    expect(toggleRes.body.is_wishlisted).toBe(true);
    expect(toggleRes.body.wishlist_count).toBe(1);

    // Now GET commercial vehicle details as the buyer: isWishlist must be true and wishlist_count must be 1
    const afterRes = await request(app)
      .get(`/api/v1/commercial/${testCommercial.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(afterRes.status).toBe(200);
    expect(afterRes.body.data.isWishlist).toBe(true);
    expect(afterRes.body.data.is_wishlist).toBe(true);
    expect(afterRes.body.data.wishlist_count).toBe(1);

    // Unauthenticated GET on commercial vehicle: isWishlist must be false
    const anonRes = await request(app).get(`/api/v1/commercial/${testCommercial.id}`);
    expect(anonRes.status).toBe(200);
    expect(anonRes.body.data.isWishlist).toBe(false);
    expect(anonRes.body.data.is_wishlist).toBe(false);
    expect(anonRes.body.data.wishlist_count).toBe(1);
  });

  test('4. Commercial Wishlist: Toggle removes item, updates wishlist_count to 0, sets isWishlist = false', async () => {
    const untoggleRes = await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });

    expect(untoggleRes.status).toBe(200);
    expect(untoggleRes.body.success).toBe(true);
    expect(untoggleRes.body.isWishlist).toBe(false);
    expect(untoggleRes.body.is_wishlisted).toBe(false);
    expect(untoggleRes.body.wishlist_count).toBe(0);

    // Verify GET reflects isWishlist = false and wishlist_count = 0
    const checkRes = await request(app)
      .get(`/api/v1/commercial/${testCommercial.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.isWishlist).toBe(false);
    expect(checkRes.body.data.is_wishlist).toBe(false);
    expect(checkRes.body.data.wishlist_count).toBe(0);
  });

  test('5. Seller Commercial Listings: dynamically updates isWishlist for authenticated viewer', async () => {
    // Add to wishlist again
    await request(app)
      .post('/api/v1/wishlist/toggle')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });

    // Buyer sees isWishlist = true
    const buyerView = await request(app)
      .get(`/api/v1/commercial/seller/${dealerUser.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(buyerView.status).toBe(200);
    const itemBuyer = buyerView.body.data.listings.find((v) => v.id === testCommercial.id);
    expect(itemBuyer).toBeDefined();
    expect(itemBuyer.isWishlist).toBe(true);
    expect(itemBuyer.is_wishlist).toBe(true);
    expect(itemBuyer.wishlist_count).toBe(1);

    // Another user (dealer) views same seller listings: sees isWishlist = false
    const dealerView = await request(app)
      .get(`/api/v1/commercial/seller/${dealerUser.id}`)
      .set('Authorization', `Bearer ${dealerToken}`);

    expect(dealerView.status).toBe(200);
    const itemDealer = dealerView.body.data.listings.find((v) => v.id === testCommercial.id);
    expect(itemDealer).toBeDefined();
    expect(itemDealer.isWishlist).toBe(false);
    expect(itemDealer.is_wishlist).toBe(false);
    expect(itemDealer.wishlist_count).toBe(1);
  });
});
