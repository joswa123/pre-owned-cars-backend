// tests/commercial-requirement.test.js
process.env.NODE_ENV = 'test';

const describe = global.describe || ((name, fn) => { console.log(name); fn(); });
const it = global.it || ((name, fn) => { fn(); console.log('  ✓ ' + name); });

const assert = require('assert');
const {
  Requirement,
  CarType,
  Brand,
  Model,
  CommercialVehicle,
  Notification,
  User,
} = require('../src/models');
const requirementRoutes = require('../src/routes/v1/requirementRoutes');
const adminRoutes = require('../src/routes/v1/adminRoutes');
const requirementController = require('../src/controllers/requirementController');
const requirementService = require('../src/services/requirementService');
const requirementMatchingService = require('../src/services/requirementMatchingService');
const notificationQueue = require('../src/queues/notificationQueue');
const {
  createRequirementSchema,
  updateRequirementSchema,
  updateRequirementStatusSchema,
  queryRequirementSchema,
} = require('../src/validations/requirementValidation');

describe('Commercial Vehicle Support for Buying Requirements Tests', () => {
  it('Step 1: Requirement model attributes and associations', () => {
    // Attributes
    const attrs = Requirement.rawAttributes;
    assert(attrs.target_type, 'Requirement should have target_type column');
    assert.deepStrictEqual(attrs.target_type.values, ['car', 'commercial']);
    assert.strictEqual(attrs.target_type.defaultValue, 'car');

    assert(attrs.vehicle_type_id, 'Requirement should have vehicle_type_id column');
    assert.strictEqual(attrs.model_id.allowNull, true, 'model_id should allow NULL for commercial');
    assert.strictEqual(attrs.body_type.allowNull, true, 'body_type should allow NULL for commercial');
    assert.strictEqual(attrs.board_type.allowNull, true, 'board_type should allow NULL for commercial');

    // Associations
    assert(Requirement.associations.vehicleType, 'Requirement should belong to CarType as vehicleType');
    assert.strictEqual(Requirement.associations.vehicleType.foreignKey, 'vehicle_type_id');

    assert(CarType.associations.requirements, 'CarType should haveMany Requirement as requirements');
    assert(CommercialVehicle.associations.notifications, 'CommercialVehicle should haveMany Notification');
    assert(Notification.associations.commercialVehicle, 'Notification should belongTo CommercialVehicle');
  });

  it('Step 2: Joi validation for Commercial Requirements (valid payload)', () => {
    const commercialPayload = {
      target_type: 'commercial',
      brandName: 'Tata',
      vehicleTypeName: 'Mini Truck',
      year: 2022,
      price: { min: 200000, max: 500000 },
      km_driven: { min: 10000, max: 60000 },
      purchase_plan: '30 Days',
      description: 'Looking for commercial mini truck in good condition',
    };

    const { error, value } = createRequirementSchema.validate(commercialPayload);
    assert.ifError(error);
    assert.strictEqual(value.target_type, 'commercial');
    assert.strictEqual(value.brandName, 'Tata');
    assert.strictEqual(value.vehicleTypeName, 'Mini Truck');
    assert.strictEqual(value.year, 2022);
  });

  it('Step 3: Joi validation for Commercial Requirements (missing vehicle type or brand fails)', () => {
    // Missing vehicleTypeName / vehicle_type_id
    const missingTypePayload = {
      target_type: 'commercial',
      brandName: 'Tata',
      purchase_plan: 30,
    };
    const res1 = createRequirementSchema.validate(missingTypePayload);
    assert(res1.error, 'Should fail validation when vehicle_type is missing');
    assert(res1.error.message.includes('vehicle_type_id or vehicleTypeName is required'));

    // Missing brandName / brand_id
    const missingBrandPayload = {
      target_type: 'commercial',
      vehicleTypeName: 'Pickup',
      purchase_plan: '1 Month',
    };
    const res2 = createRequirementSchema.validate(missingBrandPayload);
    assert(res2.error, 'Should fail validation when brand is missing');
    assert(res2.error.message.includes('brand_id or brandName is required'));
  });

  it('Step 4: Backward compatibility for Car Requirements (model_id, body_type, board_type enforced)', () => {
    const carMissingModel = {
      target_type: 'car',
      brand_id: '00000000-0000-0000-0000-000000000001',
      purchase_plan: 30,
    };
    const res = createRequirementSchema.validate(carMissingModel);
    assert(res.error, 'Should enforce model for car requirements');
    assert(res.error.message.includes('model_id is required'));
  });

  it('Step 5: Status update validation accepts sold and inactive aliases', () => {
    // Sold alias
    const soldRes = updateRequirementStatusSchema.validate({
      status: 'sold',
      bought_from: 'Direct Owner',
    });
    assert.ifError(soldRes.error);

    // Inactive alias
    const inactiveRes = updateRequirementStatusSchema.validate({
      status: 'inactive',
    });
    assert.ifError(inactiveRes.error);
  });

  it('Step 6: Requirement routes include match-cars and match-vehicles alias', () => {
    const routes = requirementRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const paths = routes.map((r) => r.path);
    assert(paths.includes('/'), 'Route POST / should exist');
    assert(paths.includes('/me'), 'Route GET /me should exist');
    assert(paths.includes('/:id'), 'Route GET /:id should exist');
    assert(paths.includes('/:id/match-cars'), 'Route GET /:id/match-cars should exist');
    assert(paths.includes('/:id/match-vehicles'), 'Route GET /:id/match-vehicles should exist');
    assert(paths.includes('/:id/status'), 'Route PATCH /:id/status should exist');
  });

  it('Step 7: Admin routes include /requirements', () => {
    const routes = adminRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);
    assert(routes.includes('/requirements'), 'Route GET /requirements should exist on admin router');
  });

  it('Step 8: resolvePurchasePlanDays unit tests', () => {
    assert.strictEqual(requirementService.resolvePurchasePlanDays(15), 15);
    assert.strictEqual(requirementService.resolvePurchasePlanDays('30 Days'), 30);
    assert.strictEqual(requirementService.resolvePurchasePlanDays('1 Month'), 30);
    assert.strictEqual(requirementService.resolvePurchasePlanDays('2 Months'), 60);
    assert.strictEqual(requirementService.resolvePurchasePlanDays('Immediate'), 7);
    assert.strictEqual(requirementService.resolvePurchasePlanDays(null), 30);
    assert.strictEqual(requirementService.resolvePurchasePlanDays(undefined), 30);
  });

  it('Step 9: formatRequirement produces correct vehicle_name for commercial and car', () => {
    // Commercial requirement
    const commReq = {
      id: 'comm-req-1',
      target_type: 'commercial',
      year: 2021,
      brand: { name: 'Ashok Leyland' },
      vehicleType: { name: 'Tipper' },
      carModel: null,
    };
    const formattedComm = requirementService.formatRequirement(commReq);
    assert.strictEqual(formattedComm.target_type, 'commercial');
    assert.strictEqual(formattedComm.brand_name, 'Ashok Leyland');
    assert.strictEqual(formattedComm.vehicle_type_name, 'Tipper');
    assert.strictEqual(formattedComm.vehicle_name, 'Ashok Leyland Tipper 2021');

    // Car requirement
    const carReq = {
      id: 'car-req-1',
      target_type: 'car',
      year: 2023,
      brand: { name: 'Maruti Suzuki' },
      carModel: { name: 'Swift' },
      vehicleType: null,
    };
    const formattedCar = requirementService.formatRequirement(carReq);
    assert.strictEqual(formattedCar.target_type, 'car');
    assert.strictEqual(formattedCar.brand_name, 'Maruti Suzuki');
    assert.strictEqual(formattedCar.model_name, 'Swift');
    assert.strictEqual(formattedCar.vehicle_name, 'Maruti Suzuki Swift 2023');
  });

  it('Step 10: requirementMatchingService exports matchRequirementsForCommercialVehicle', () => {
    assert.strictEqual(typeof requirementMatchingService.matchRequirementsForCommercialVehicle, 'function');
    assert.strictEqual(typeof requirementMatchingService.matchRequirementsForCar, 'function');
  });

  it('Step 11: Notification Queue supports commercial vehicle matching', () => {
    assert(notificationQueue, 'Notification queue should be exported');
    assert.strictEqual(typeof notificationQueue.add, 'function');
  });

  it('Step 12: commercialVehicleService exports getCommercialWishlistCountMap', () => {
    const { getCommercialWishlistCountMap } = require('../src/services/commercialVehicleService');
    assert.strictEqual(typeof getCommercialWishlistCountMap, 'function');
  });
});

