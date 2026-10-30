'use strict';

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { User, Category, VehicleType, Brand, BrandType, Car } = require('../src/models');

const BASE_URL = 'http://localhost:5000';

async function req(path, options = {}) {
  const url = BASE_URL + path;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
    failed++;
  }
}

async function runAllTestCases() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPLETE TEST SUITE: VEHICLE TYPES & BRANDS');
  console.log('================================================================\n');

  // Setup Admin and Customer users
  const adminUser = await User.findOne({ where: { role: 'admin' } });
  const adminToken = jwt.sign(
    { id: adminUser.id, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  let customerUser = await User.findOne({ where: { role: 'customer' } });
  if (!customerUser) {
    customerUser = await User.create({
      phone: '9888888888',
      role: 'customer',
      status: 'approved',
      is_verified: true,
    });
  }
  const customerToken = jwt.sign(
    { id: customerUser.id, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  const customerHeaders = {
    'Authorization': `Bearer ${customerToken}`,
    'Content-Type': 'application/json',
  };

  let commercialCategory = await Category.findOne({ where: { slug: 'commercial' } });
  const categoryId = commercialCategory ? commercialCategory.id : null;

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: PUBLIC ENDPOINTS
  // ─────────────────────────────────────────────────────────────
  console.log('📌 SUITE 1: Public Endpoints (App Consumers)');

  // Test 1.1
  const t1_1 = await req('/api/v1/types');
  assert(t1_1.status === 200 && Array.isArray(t1_1.data?.data) && t1_1.data.data.length >= 29,
    'GET /api/v1/types returns all active vehicle types (>= 29 types)',
    `Status: ${t1_1.status}, Count: ${t1_1.data?.data?.length}`
  );

  // Test 1.2
  const t1_2 = await req('/api/v1/types?category=commercial');
  const allCommercial = t1_2.data?.data?.every(t => t.category?.slug === 'commercial');
  assert(t1_2.status === 200 && t1_2.data?.data?.length === 10 && allCommercial,
    'GET /api/v1/types?category=commercial returns exactly 10 commercial vehicle types',
    `Count: ${t1_2.data?.data?.length}, allCommercial: ${allCommercial}`
  );

  // Test 1.3
  const t1_3 = await req('/api/v1/car-types');
  assert(t1_3.status === 200 && Array.isArray(t1_3.data?.data),
    'GET /api/v1/car-types backward compatibility endpoint returns 200 OK',
    `Status: ${t1_3.status}`
  );

  // Test 1.4
  const t1_4 = await req('/api/v1/types/non-existent-type-slug-xyz');
  assert(t1_4.status === 404 && t1_4.data?.success === false,
    'GET /api/v1/types/:id with non-existent slug returns 404 Not Found',
    `Status: ${t1_4.status}`
  );

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: SECURITY & VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n📌 SUITE 2: Security & Validation');

  // Test 2.1
  const t2_1 = await req('/api/v1/admin/types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauth Type' }),
  });
  assert(t2_1.status === 401,
    'POST /api/v1/admin/types without token rejects with 401 Unauthorized',
    `Status: ${t2_1.status}`
  );

  // Test 2.2
  const t2_2 = await req('/api/v1/admin/types', {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({ name: 'Customer Type' }),
  });
  assert(t2_2.status === 403,
    'POST /api/v1/admin/types with customer token rejects with 403 Forbidden',
    `Status: ${t2_2.status}`
  );

  // Test 2.3
  const t2_3 = await req('/api/v1/admin/types', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: '' }),
  });
  assert(t2_3.status === 400 && t2_3.data?.success === false,
    'POST /api/v1/admin/types with empty name rejects with 400 Bad Request',
    `Status: ${t2_3.status}`
  );

  // Test 2.4
  const t2_4 = await req('/api/v1/admin/brands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauth Brand' }),
  });
  assert(t2_4.status === 401,
    'POST /api/v1/admin/brands without token rejects with 401 Unauthorized',
    `Status: ${t2_4.status}`
  );

  // Test 2.5
  const t2_5 = await req('/api/v1/admin/brands', {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({ name: 'Customer Brand' }),
  });
  assert(t2_5.status === 403,
    'POST /api/v1/admin/brands with customer token rejects with 403 Forbidden',
    `Status: ${t2_5.status}`
  );

  // ─────────────────────────────────────────────────────────────
  // SUITE 3: ADMIN VEHICLE TYPES CRUD
  // ─────────────────────────────────────────────────────────────
  console.log('\n📌 SUITE 3: Admin Vehicle Types CRUD');

  let testTypeId;
  const uniqueTypeName = `Automated Bulldozer ${Date.now()}`;

  // Test 3.1
  const t3_1 = await req('/api/v1/admin/types', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: uniqueTypeName,
      category_id: categoryId,
      order: 77,
      is_active: true,
    }),
  });
  testTypeId = t3_1.data?.data?.id;
  assert(t3_1.status === 201 && testTypeId && t3_1.data?.data?.name === uniqueTypeName,
    'POST /api/v1/admin/types creates new vehicle type with category_id',
    `Status: ${t3_1.status}, ID: ${testTypeId}`
  );

  // Test 3.2
  const t3_2 = await req('/api/v1/admin/types', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: uniqueTypeName,
    }),
  });
  assert(t3_2.status === 409,
    'POST /api/v1/admin/types duplicate name returns 409 Conflict',
    `Status: ${t3_2.status}`
  );

  // Test 3.3
  const t3_3 = await req('/api/v1/admin/types', {
    headers: authHeaders,
  });
  const foundType = t3_3.data?.data?.find(t => t.id === testTypeId);
  assert(t3_3.status === 200 && Boolean(foundType),
    'GET /api/v1/admin/types lists newly created vehicle type',
    `Status: ${t3_3.status}, Found: ${Boolean(foundType)}`
  );

  // Test 3.4
  const updatedTypeName = `${uniqueTypeName} Prime`;
  const t3_4 = await req(`/api/v1/admin/types/${testTypeId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: updatedTypeName,
      order: 88,
    }),
  });
  assert(t3_4.status === 200 && t3_4.data?.data?.name === updatedTypeName && t3_4.data?.data?.order === 88,
    'PUT /api/v1/admin/types/:id updates vehicle type name and order',
    `Status: ${t3_4.status}, Name: ${t3_4.data?.data?.name}`
  );

  // ─────────────────────────────────────────────────────────────
  // SUITE 4: ADMIN BRANDS CRUD & TYPE ASSOCIATIONS
  // ─────────────────────────────────────────────────────────────
  console.log('\n📌 SUITE 4: Admin Brands CRUD & Many-to-Many Type Syncing');

  let testBrandId;
  const uniqueBrandName = `Titan Machinery ${Date.now()}`;

  // Test 4.1
  const t4_1 = await req('/api/v1/admin/brands', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: uniqueBrandName,
      type_ids: [testTypeId],
      is_active: true,
    }),
  });
  testBrandId = t4_1.data?.data?.id;
  const linkedTypes = t4_1.data?.data?.types || [];
  assert(t4_1.status === 201 && testBrandId && linkedTypes.some(t => t.id === testTypeId),
    'POST /api/v1/admin/brands creates brand with type_ids array atomically',
    `Status: ${t4_1.status}, Brand ID: ${testBrandId}, Linked: ${linkedTypes.length}`
  );

  // Test 4.2
  const t4_2 = await req(`/api/v1/admin/types/${testTypeId}/brands`, {
    headers: authHeaders,
  });
  assert(t4_2.status === 200 && t4_2.data?.data?.some(b => b.id === testBrandId),
    'GET /api/v1/admin/types/:typeId/brands retrieves brands linked to specific type',
    `Status: ${t4_2.status}, Count: ${t4_2.data?.data?.length}`
  );

  // Test 4.3 (Public dropdown consumer)
  const t4_3 = await req(`/api/v1/types/${testTypeId}/brands`);
  assert(t4_3.status === 200 && t4_3.data?.data?.some(b => b.id === testBrandId),
    'GET /api/v1/types/:typeId/brands (Public) populates active brands for dropdown',
    `Status: ${t4_3.status}, Found: ${t4_3.data?.data?.length}`
  );

  // Test 4.4
  const updatedBrandName = `${uniqueBrandName} Global`;
  const t4_4 = await req(`/api/v1/admin/brands/${testBrandId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: updatedBrandName,
      type_ids: [testTypeId],
    }),
  });
  assert(t4_4.status === 200 && t4_4.data?.data?.name === updatedBrandName,
    'PUT /api/v1/admin/brands/:id updates brand and re-syncs type associations',
    `Status: ${t4_4.status}, Name: ${t4_4.data?.data?.name}`
  );

  // Test 4.5
  const t4_5 = await req(`/api/v1/admin/brands/${testBrandId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(t4_5.status === 200 && t4_5.data?.success === true,
    'DELETE /api/v1/admin/brands/:id deletes brand and cleans junction mappings',
    `Status: ${t4_5.status}, Message: ${t4_5.data?.message}`
  );

  // Test 4.6
  const t4_6 = await req(`/api/v1/admin/types/${testTypeId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert(t4_6.status === 200 && t4_6.data?.success === true,
    'DELETE /api/v1/admin/types/:id deletes vehicle type cleanly',
    `Status: ${t4_6.status}, Message: ${t4_6.data?.message}`
  );

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTestCases().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
