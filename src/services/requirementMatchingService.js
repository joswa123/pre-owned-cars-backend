const { Requirement, Notification, Car, Brand, Model, User } = require('../models');
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
