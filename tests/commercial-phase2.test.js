// tests/commercial-phase2.test.js
process.env.NODE_ENV = 'test';
const { 
  User, 
  Car, 
  VehicleType, 
  Category, 
  Brand, 
  BrandType, 
  CommercialVehicle, 
  CommercialVehicleImage 
} = require('../src/models');
const { resolveTarget } = require('../src/utils/targetResolver');
const { randomUUID } = require('crypto');

describe('Phase 2 — Commercial Vehicle Entities & Media Integration Tests', () => {
  let testUser;
  let commercialType;
  let passengerType;
  let testBrand;
  let createdVehicleIds = [];
  let createdUserIds = [];

  const getUniquePhone = () => {
    return '9' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);
  };

  beforeAll(async () => {
    // 1. Create Test User
    testUser = await User.create({
      full_name: 'Commercial Tester',
      phone: getUniquePhone(),
      email: `comm-tester-${Date.now()}@autodeal.com`,
      password_hash: '$2a$12$dummyhashforcommercialtester',
      role: 'dealer',
      status: 'approved',
      is_verified: true,
    });
    createdUserIds.push(testUser.id);

    // 2. Fetch Commercial Vehicle Type (e.g., Trucks)
    commercialType = await VehicleType.findOne({
      where: { slug: 'trucks' },
    });
    if (!commercialType) {
      commercialType = await VehicleType.findOne();
    }

    // 3. Fetch Passenger Car Type (e.g., Sedan, SUV, or Hatchback)
    const [passengerCat] = await Category.findOrCreate({
      where: { slug: 'cars' },
      defaults: { name: 'Cars', slug: 'cars' },
    });
    passengerType = await VehicleType.findOne({
      where: { category_id: passengerCat.id },
    });

    // 4. Fetch a commercial brand (e.g. Ashok Leyland or BharatBenz)
    testBrand = await Brand.findOne({
      where: { slug: 'ashok-leyland' },
    });
    if (!testBrand) {
      testBrand = await Brand.findOne({ where: { slug: 'bharatbenz' } });
    }
  });

  afterAll(async () => {
    for (const id of createdVehicleIds) {
      await CommercialVehicleImage.destroy({ where: { commercial_vehicle_id: id } }).catch(() => {});
      await CommercialVehicle.destroy({ where: { id }, force: true }).catch(() => {});
    }
    for (const id of createdUserIds) {
      await User.destroy({ where: { id } }).catch(() => {});
    }
  });

  // ── Test 1: CommercialVehicle model creation, validation & attributes ──
  test('1. CommercialVehicle creates successfully with valid attributes & soft deletes', async () => {
    const slug = `ashok-leyland-truck-${Date.now()}`;
    const vehicle = await CommercialVehicle.create({
      user_id: testUser.id,
      vehicle_type_id: commercialType.id,
      brand_id: testBrand.id,
      year: 2022,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      km_driven: 45000,
      price: 1850000,
      description: 'Excellent condition heavy duty truck',
      posted_by_type: 'dealer',
      status: 'active',
      slug,
    });

    expect(vehicle).toBeDefined();
    expect(vehicle.id).toBeDefined();
    createdVehicleIds.push(vehicle.id);

    expect(vehicle.year).toBe(2022);
    expect(vehicle.price).toBe(1850000);
    expect(vehicle.status).toBe('active');
    expect(vehicle.views_count).toBe(0);
    expect(vehicle.is_featured).toBe(false);

    // Verify soft-delete
    await vehicle.destroy();
    const softDeleted = await CommercialVehicle.findOne({
      where: { id: vehicle.id },
      paranoid: false,
    });
    expect(softDeleted).not.toBeNull();
    expect(softDeleted.deleted_at).not.toBeNull();

    // Regular query excludes soft-deleted
    const normalQuery = await CommercialVehicle.findOne({ where: { id: vehicle.id } });
    expect(normalQuery).toBeNull();

    // Restore for subsequent tests
    await vehicle.restore();
  });

  // ── Test 2: Slug uniqueness enforcement ──
  test('2. Enforces unique slug constraint on CommercialVehicle', async () => {
    const duplicateSlug = `unique-truck-${Date.now()}`;
    const v1 = await CommercialVehicle.create({
      user_id: testUser.id,
      vehicle_type_id: commercialType.id,
      brand_id: testBrand.id,
      year: 2021,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      km_driven: 50000,
      price: 1500000,
      posted_by_type: 'dealer',
      status: 'active',
      slug: duplicateSlug,
    });
    createdVehicleIds.push(v1.id);

    // Attempting to create another vehicle with identical slug must reject
    await expect(
      CommercialVehicle.create({
        user_id: testUser.id,
        vehicle_type_id: commercialType.id,
        brand_id: testBrand.id,
        year: 2020,
        fuel_type: 'Diesel',
        ownership: '2nd Owner',
        km_driven: 80000,
        price: 1200000,
        posted_by_type: 'dealer',
        status: 'active',
        slug: duplicateSlug,
      })
    ).rejects.toThrow();
  });

  // ── Test 3: Exactly one primary image enforced via partial unique index ──
  test('3. Enforces exactly one primary image per vehicle via partial unique constraint', async () => {
    const vehicle = await CommercialVehicle.create({
      user_id: testUser.id,
      vehicle_type_id: commercialType.id,
      brand_id: testBrand.id,
      year: 2023,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      km_driven: 10000,
      price: 2500000,
      posted_by_type: 'dealer',
      status: 'active',
      slug: `primary-img-test-${Date.now()}`,
    });
    createdVehicleIds.push(vehicle.id);

    // 1. Multiple non-primary images can coexist
    const img1 = await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/sample1.jpg',
      is_primary: false,
      sort_order: 1,
    });
    const img2 = await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/sample2.jpg',
      is_primary: false,
      sort_order: 2,
    });
    expect(img1.id).toBeDefined();
    expect(img2.id).toBeDefined();

    // 2. Setting first primary image succeeds
    const primaryImg1 = await CommercialVehicleImage.create({
      commercial_vehicle_id: vehicle.id,
      image_url: 'https://res.cloudinary.com/demo/image/upload/primary1.jpg',
      is_primary: true,
      sort_order: 0,
    });
    expect(primaryImg1.id).toBeDefined();

    // 3. Inserting a second primary image for the same vehicle MUST reject with unique constraint violation
    await expect(
      CommercialVehicleImage.create({
        commercial_vehicle_id: vehicle.id,
        image_url: 'https://res.cloudinary.com/demo/image/upload/primary2.jpg',
        is_primary: true,
        sort_order: 3,
      })
    ).rejects.toThrow();
  });

  // ── Test 4: resolveTarget resolves CommercialVehicle in Phase 2 ──
  test('4. resolveTarget("commercial", id) resolves CommercialVehicle instance', async () => {
    const vehicle = await CommercialVehicle.create({
      user_id: testUser.id,
      vehicle_type_id: commercialType.id,
      brand_id: testBrand.id,
      year: 2022,
      fuel_type: 'Diesel',
      ownership: '1st Owner',
      km_driven: 20000,
      price: 2100000,
      posted_by_type: 'dealer',
      status: 'active',
      slug: `target-resolve-${Date.now()}`,
    });
    createdVehicleIds.push(vehicle.id);

    const resolved = await resolveTarget('commercial', vehicle.id);
    expect(resolved).not.toBeNull();
    expect(resolved.id).toBe(vehicle.id);
    expect(resolved.slug).toBe(vehicle.slug);
    expect(resolved.price).toBe(2100000);

    // Non-existent commercial vehicle returns null
    const nonExistent = await resolveTarget('commercial', randomUUID());
    expect(nonExistent).toBeNull();
  });

  // ── Test 5: brand_types pivot links commercial brands to commercial types only ──
  test('5. brand_types pivot links commercial brands to commercial vehicle types, not passenger car types', async () => {
    // 1. Ashok Leyland must be linked to the commercial vehicle type
    const commercialPivot = await BrandType.findOne({
      where: {
        brand_id: testBrand.id,
        type_id: commercialType.id,
      },
    });
    expect(commercialPivot).not.toBeNull();

    // 2. Ashok Leyland must NOT be linked to passenger car types
    if (passengerType) {
      const passengerPivot = await BrandType.findOne({
        where: {
          brand_id: testBrand.id,
          type_id: passengerType.id,
        },
      });
      expect(passengerPivot).toBeNull();
    }
  });
});
