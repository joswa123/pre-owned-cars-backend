const { Requirement, Notification, Car, CommercialVehicle, Brand, Model, CarType, User } = require('../models');
const { Op } = require('sequelize');
const pushNotificationService = require('./pushNotificationService');
const { parseTransmissionList } = require('./requirementService');

/**
 * Matches active buying requirements against a newly created or updated car.
 * Uses a coarse SQL filter to fetch candidate requirements followed by an exact
 * JavaScript evaluation to prevent false substring matches (e.g. 'Manual' vs 'Clutchless Manual').
 *
 * @param {string} carId - The ID of the listed car
 */
exports.matchRequirementsForCar = async (carId) => {
  try {
    const car = await Car.findByPk(carId, {
      include: [
        { model: Brand, as: 'brand' },
        { model: Model, as: 'carModel' }
      ]
    });

    if (!car) {
      console.warn(`[Matching Service] Car not found with ID: ${carId}`);
      return;
    }

    const carTransmission = (car.transmission || '').trim();
    const carTransLower = carTransmission.toLowerCase();

    const whereConditions = {
      status: 'active',
      [Op.or]: [
        { target_type: 'car' },
        { target_type: null }
      ],
      expiry_date: {
        [Op.gt]: new Date()
      },
      user_id: { [Op.ne]: car.user_id },
      brand_id: car.brand_id,
      model_id: car.model_id,
      [Op.and]: [
        {
          [Op.or]: [
            { year: null },
            { year: car.year }
          ]
        },
        {
          [Op.or]: [
            { min_price: null },
            { min_price: { [Op.lte]: car.price } }
          ]
        },
        {
          [Op.or]: [
            { max_price: null },
            { max_price: { [Op.gte]: car.price } }
          ]
        },
        {
          [Op.or]: [
            { min_km: null },
            { min_km: { [Op.lte]: car.km_driven } }
          ]
        },
        {
          [Op.or]: [
            { max_km: null },
            { max_km: { [Op.gte]: car.km_driven } }
          ]
        },
        {
          [Op.or]: [
            { body_type: null },
            { body_type: '' },
            { body_type: 'Any' },
            { body_type: car.body_type }
          ]
        },
        {
          // Coarse SQL filter: wildcard requirements or substring match
          [Op.or]: [
            { transmission: null },
            { transmission: '' },
            { transmission: 'Any' },
            { transmission: { [Op.like]: `%${carTransmission}%` } },
            { transmission: { [Op.like]: `%${carTransLower}%` } }
          ]
        },
        {
          [Op.or]: [
            { board_type: null },
            { board_type: '' },
            { board_type: 'Any' },
            { board_type: car.board_type }
          ]
        }
      ]
    };

    const requirements = await Requirement.findAll({ where: whereConditions });

    if (!requirements.length) {
      return;
    }

    for (const req of requirements) {
      // 1. Multi-transmission precision check:
      // If the requirement specified one or more transmissions, ensure car's transmission is included.
      if (req.transmission && req.transmission.trim() !== '' && req.transmission.toLowerCase() !== 'any') {
        const parsedReqTrans = parseTransmissionList(req.transmission).map(t => t.toLowerCase());
        if (parsedReqTrans.length > 0 && !parsedReqTrans.includes(carTransLower)) {
          // Skip false positive (e.g. car 'Manual' matching requirement 'Clutchless Manual')
          continue;
        }
      }

      // 2. Global deduplication per user and car:
      // Avoid spamming buyer with multiple notifications if they have multiple matching requirements
      const existingNotification = await Notification.findOne({
        where: {
          user_id: req.user_id,
          car_id: car.id,
          type: 'requirement_match',
        }
      });

      if (!existingNotification) {
        const brandName = car.brand ? car.brand.name : 'A';
        const modelName = car.carModel ? car.carModel.name : 'car';
        const message = `A new car matching your requirement "${brandName} ${modelName}" has been listed.`;
        
        await Notification.create({
          user_id: req.user_id,
          requirement_id: req.id,
          car_id: car.id,
          target_type: 'car',
          target_id: car.id,
          type: 'requirement_match',
          message: message,
        });

        // Send push notification
        await pushNotificationService.sendPushToUser(
          req.user_id,
          'New Car Match! 🚗',
          message,
          { carId: car.id, requirementId: req.id, type: 'requirement_match' }
        );
      }
    }
  } catch (error) {
    console.error('[Matching Service] Error matching requirements:', error);
  }
};

/**
 * Matches active buying requirements against a newly created or updated commercial vehicle.
 * Coarse SQL filter fetches candidate requirements for target_type='commercial',
 * matching brand_id, vehicle_type_id, year, price range, and km range.
 *
 * @param {string} commercialVehicleId - The ID of the listed commercial vehicle
 */
exports.matchRequirementsForCommercialVehicle = async (commercialVehicleId) => {
  try {
    const vehicle = await CommercialVehicle.findByPk(commercialVehicleId, {
      include: [
        { model: Brand, as: 'brand' },
        { model: CarType, as: 'vehicleType' }
      ]
    });

    if (!vehicle) {
      console.warn(`[Matching Service] Commercial vehicle not found with ID: ${commercialVehicleId}`);
      return;
    }

    if (vehicle.status !== 'active') {
      return;
    }

    const whereConditions = {
      target_type: 'commercial',
      status: 'active',
      expiry_date: {
        [Op.gt]: new Date()
      },
      user_id: { [Op.ne]: vehicle.user_id },
      brand_id: vehicle.brand_id,
      vehicle_type_id: vehicle.vehicle_type_id,
      [Op.and]: [
        {
          [Op.or]: [
            { year: null },
            { year: vehicle.year }
          ]
        },
        {
          [Op.or]: [
            { min_price: null },
            { min_price: { [Op.lte]: vehicle.price } }
          ]
        },
        {
          [Op.or]: [
            { max_price: null },
            { max_price: { [Op.gte]: vehicle.price } }
          ]
        },
        {
          [Op.or]: [
            { min_km: null },
            { min_km: { [Op.lte]: vehicle.km_driven } }
          ]
        },
        {
          [Op.or]: [
            { max_km: null },
            { max_km: { [Op.gte]: vehicle.km_driven } }
          ]
        }
      ]
    };

    const requirements = await Requirement.findAll({ where: whereConditions });

    if (!requirements.length) {
      return;
    }

    for (const req of requirements) {
      // Global deduplication check: avoid duplicate notifications for same commercial vehicle & user
      const existingNotification = await Notification.findOne({
        where: {
          user_id: req.user_id,
          target_type: 'commercial',
          target_id: vehicle.id,
          type: 'requirement_match'
        }
      });

      if (!existingNotification) {
        const brandName = vehicle.brand ? vehicle.brand.name : 'Commercial';
        const typeName = vehicle.vehicleType ? vehicle.vehicleType.name : 'Vehicle';
        const message = `A new commercial vehicle matching your requirement "${brandName} ${typeName}" has been listed.`;

        await Notification.create({
          user_id: req.user_id,
          requirement_id: req.id,
          target_type: 'commercial',
          target_id: vehicle.id,
          type: 'requirement_match',
          message: message
        });

        // Send push notification
        await pushNotificationService.sendPushToUser(
          req.user_id,
          'New Commercial Vehicle Match! 🚚',
          message,
          {
            commercialVehicleId: vehicle.id,
            target_id: vehicle.id,
            target_type: 'commercial',
            requirementId: req.id,
            type: 'requirement_match'
          }
        );
      }
    }
  } catch (error) {
    console.error('[Matching Service] Error matching commercial requirements:', error);
  }
};
