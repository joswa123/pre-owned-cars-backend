const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  User,
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

describe('Wishlist Deletion Robustness Integration Tests', () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let sellerUser;
  let buyerUser;
  let buyerToken;
  let testBrand;
  let testModel;
  let testVariant;
  let testCarType;
  let testState;
  let testDistrict;
  let testCity;

  let testCar;
  let testCommercial;

  beforeAll(async () => {
    testState = await State.findOne({ where: { name: 'Tamil Nadu' } });
    testDistrict = await District.findOne({ where: { state_id: testState.id } });
    testCity = await City.findOne({ where: { district_id: testDistrict.id } });

    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    sellerUser = await User.create({
      full_name: `Seller ${suffix}`,
      phone: makePhone('9'),
      email: `wlseller_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      status: 'approved',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    buyerUser = await User.create({
      full_name: `Buyer ${suffix}`,
      phone: makePhone('8'),
      email: `wlbuyer_${suffix}@example.com`,
      password_hash: passwordHash,
      role: 'customer',
      status: 'approved',
      is_verified: true,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    buyerToken = jwt.sign(
      { id: buyerUser.id, role: buyerUser.role, email: buyerUser.email },
      process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-min!!',
      { expiresIn: '1h' }
    );

    testBrand = await Brand.create({
      name: `WLBrand_${suffix}`,
      slug: `wl-brand-${suffix}`,
      is_active: true,
    });

    testModel = await Model.create({
      brandId: testBrand.id,
      name: `WLModel_${suffix}`,
      slug: `wl-model-${suffix}`,
      is_active: true,
    });

    testVariant = await Variant.create({
      model_id: testModel.id,
      name: `WLVariant_${suffix}`,
      slug: `wl-variant-${suffix}`,
      is_active: true,
    });

    testCarType = await CarType.create({
      name: `WLType_${suffix}`,
      slug: `wl-type-${suffix}`,
      is_active: true,
    });

    testCar = await Car.create({
      user_id: sellerUser.id,
      brand_id: testBrand.id,
      model_id: testModel.id,
      variant_id: testVariant.id,
      year: 2021,
      price: 500000,
      km_driven: 30000,
      fuel_type: 'petrol',
      transmission: 'manual',
      ownership: '1st owner',
      body_type: 'Sedan',
      status: 'active',
      posted_by_type: 'customer',
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });

    testCommercial = await CommercialVehicle.create({
      user_id: sellerUser.id,
      brand_id: testBrand.id,
      vehicle_type_id: testCarType.id,
      year: 2022,
      price: 750000,
      km_driven: 45000,
      fuel_type: 'diesel',
      transmission: 'manual',
      ownership: '1st owner',
      status: 'active',
      posted_by_type: 'customer',
      slug: `wl-comm-${suffix}`,
      state_id: testState.id,
      district_id: testDistrict.id,
      city_id: testCity.id,
    });
  });

  afterAll(async () => {
    try {
      await Wishlist.destroy({ where: { user_id: [sellerUser?.id, buyerUser?.id].filter(Boolean) } });
      if (testCommercial) await CommercialVehicle.destroy({ where: { id: testCommercial.id }, force: true });
      if (testCar) await Car.destroy({ where: { id: testCar.id }, force: true });
      if (testVariant) await Variant.destroy({ where: { id: testVariant.id } });
      if (testModel) await Model.destroy({ where: { id: testModel.id } });
      if (testCarType) await CarType.destroy({ where: { id: testCarType.id } });
      if (testBrand) await Brand.destroy({ where: { id: testBrand.id } });
      if (buyerUser) await User.destroy({ where: { id: buyerUser.id } });
      if (sellerUser) await User.destroy({ where: { id: sellerUser.id } });
    } catch (e) {
      // ignore
    }
  });

  it('1. Delete commercial wishlist via DELETE /api/v1/wishlist/:id using Wishlist Row PK', async () => {
    // Add to wishlist
    const addRes = await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });
    expect(addRes.status).toBe(200);
    const wishlistRowId = addRes.body.data.id;
    expect(wishlistRowId).toBeDefined();

    // Delete using Wishlist primary key ID
    const delRes = await request(app)
      .delete(`/api/v1/wishlist/${wishlistRowId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.isWishlist).toBe(false);
    expect(delRes.body.wishlist_count).toBe(0);

    // Verify row is destroyed
    const row = await Wishlist.findByPk(wishlistRowId);
    expect(row).toBeNull();
  });

  it('2. Delete car wishlist via DELETE /api/v1/wishlist/:id using Wishlist Row PK', async () => {
    // Add car to wishlist
    const addRes = await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: testCar.id, target_type: 'car' });
    expect(addRes.status).toBe(200);
    const wishlistRowId = addRes.body.data.id;

    // Delete using Wishlist row PK
    const delRes = await request(app)
      .delete(`/api/v1/wishlist/${wishlistRowId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.isWishlist).toBe(false);
    expect(delRes.body.wishlist_count).toBe(0);

    const row = await Wishlist.findByPk(wishlistRowId);
    expect(row).toBeNull();
  });

  it('3. Delete commercial wishlist via DELETE /api/v1/wishlist/:commercialId WITHOUT target_type query param', async () => {
    // Add commercial to wishlist
    await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });

    // Delete passing commercial vehicle id directly in path without ?target_type=commercial
    const delRes = await request(app)
      .delete(`/api/v1/wishlist/${testCommercial.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.isWishlist).toBe(false);
    expect(delRes.body.wishlist_count).toBe(0);

    // Verify detail endpoint reflects isWishlist = false and wishlist_count = 0
    const detailRes = await request(app)
      .get(`/api/v1/commercial/${testCommercial.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(detailRes.body.data.vehicle.isWishlist).toBe(false);
    expect(detailRes.body.data.vehicle.wishlist_count).toBe(0);
  });

  it('4. Delete commercial wishlist via DELETE /api/v1/wishlist/commercial/:commercialId', async () => {
    // Add commercial to wishlist
    await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });

    // Delete via route /api/v1/wishlist/commercial/:commercialId
    const delRes = await request(app)
      .delete(`/api/v1/wishlist/commercial/${testCommercial.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.isWishlist).toBe(false);
    expect(delRes.body.wishlist_count).toBe(0);
  });

  it('5. Delete car wishlist via DELETE /api/v1/wishlist/car/:carId', async () => {
    // Add car to wishlist
    await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: testCar.id });

    // Delete via route /api/v1/wishlist/car/:carId
    const delRes = await request(app)
      .delete(`/api/v1/wishlist/car/${testCar.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.isWishlist).toBe(false);
    expect(delRes.body.wishlist_count).toBe(0);
  });

  it('6. Delete via DELETE /api/v1/wishlist with JSON body { commercial_id } and { car_id }', async () => {
    // Commercial via body
    await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ target_id: testCommercial.id, target_type: 'commercial' });

    const commDel = await request(app)
      .delete('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ commercial_id: testCommercial.id });

    expect(commDel.status).toBe(200);
    expect(commDel.body.success).toBe(true);
    expect(commDel.body.isWishlist).toBe(false);
    expect(commDel.body.wishlist_count).toBe(0);

    // Car via body
    await request(app)
      .post('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: testCar.id });

    const carDel = await request(app)
      .delete('/api/v1/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ car_id: testCar.id });

    expect(carDel.status).toBe(200);
    expect(carDel.body.success).toBe(true);
    expect(carDel.body.isWishlist).toBe(false);
    expect(carDel.body.wishlist_count).toBe(0);
  });
});
