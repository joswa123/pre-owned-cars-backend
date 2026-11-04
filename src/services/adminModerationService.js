const {
  CommercialVehicle,
  CommercialVehicleImage,
  Car,
  CarImage,
  User,
  Brand,
  CarType,
  Model,
  Variant,
  Notification,
} = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');
const { transformCommercialVehicleImages } = require('./commercialVehicleService');
const { transformCarImages } = require('./carService');

/**
 * List pending moderation listings across vehicle types
 */
exports.listPending = async ({ targetType = 'all', page = 1, limit = 20 } = {}) => {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const offset = (parsedPage - 1) * parsedLimit;

  let listings = [];
  let total = 0;

  if (targetType === 'commercial') {
    const { count, rows } = await CommercialVehicle.findAndCountAll({
      where: {
        approved_at: null,
        status: { [Op.ne]: 'deleted' },
      },
      include: [
        { model: CommercialVehicleImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'email', 'role'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      ],
      limit: parsedLimit,
      offset,
      order: [['created_at', 'DESC']],
    });

    total = count;
    listings = rows.map((v) => ({
      ...transformCommercialVehicleImages(v, null, { role: 'admin' }),
      target_type: 'commercial',
      target_id: v.id,
    }));
  } else if (targetType === 'car') {
    const { count, rows } = await Car.findAndCountAll({
      where: {
        status: 'active',
      },
      include: [
        { model: CarImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'email', 'role'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      ],
      limit: parsedLimit,
      offset,
      order: [['created_at', 'DESC']],
    });

    total = count;
    listings = rows.map((c) => ({
      ...transformCarImages(c),
      target_type: 'car',
      target_id: c.id,
    }));
  } else {
    // Union / All: Query pending commercial vehicles
    const commercialResult = await CommercialVehicle.findAndCountAll({
      where: {
        approved_at: null,
        status: { [Op.ne]: 'deleted' },
      },
      include: [
        { model: CommercialVehicleImage, as: 'images' },
        { model: User, as: 'seller', attributes: ['id', 'full_name', 'phone', 'email', 'role'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: CarType, as: 'vehicleType', attributes: ['id', 'name'] },
      ],
      limit: parsedLimit,
      offset,
      order: [['created_at', 'DESC']],
    });

    total = commercialResult.count;
    listings = commercialResult.rows.map((v) => ({
      ...transformCommercialVehicleImages(v, null, { role: 'admin' }),
      target_type: 'commercial',
      target_id: v.id,
    }));
  }

  return {
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
    listings,
  };
};

/**
 * Approve a listing by ID
 */
exports.approveListing = async ({ targetType = null, targetId, adminId }) => {
  if (!targetId) throw new AppError('Listing targetId is required', 400);

  let detectedType = targetType;
  let vehicle = null;

  if (!detectedType || detectedType === 'commercial') {
    vehicle = await CommercialVehicle.findByPk(targetId);
    if (vehicle) detectedType = 'commercial';
  }

  if (!vehicle && (!detectedType || detectedType === 'car')) {
    vehicle = await Car.findByPk(targetId);
    if (vehicle) detectedType = 'car';
  }

  if (!vehicle) {
    throw new AppError('Listing not found', 404);
  }

  if (detectedType === 'commercial') {
    await vehicle.update({
      approved_at: new Date(),
      approved_by: adminId || null,
      rejection_reason: null,
      status: 'active',
    });

    // Send notification to seller
    try {
      await Notification.create({
        user_id: vehicle.user_id,
        type: 'listing_approved',
        message: 'Your commercial vehicle listing has been approved by admin.',
        target_type: 'commercial',
        target_id: vehicle.id,
        car_id: null,
      });
    } catch (notifErr) {
      console.warn('Failed to send approval notification:', notifErr.message);
    }

    return {
      success: true,
      message: 'Commercial listing approved successfully.',
      listing: vehicle,
    };
  } else {
    await vehicle.update({ status: 'active' });

    try {
      await Notification.create({
        user_id: vehicle.user_id,
        type: 'listing_approved',
        message: 'Your car listing has been approved by admin.',
        target_type: 'car',
        target_id: vehicle.id,
        car_id: vehicle.id,
      });
    } catch (notifErr) {
      console.warn('Failed to send car approval notification:', notifErr.message);
    }

    return {
      success: true,
      message: 'Car listing approved successfully.',
      listing: vehicle,
    };
  }
};

/**
 * Reject a listing with reason
 */
exports.rejectListing = async ({ targetType = null, targetId, adminId, reason }) => {
  if (!targetId) throw new AppError('Listing targetId is required', 400);
  if (!reason || !String(reason).trim()) {
    throw new AppError('Rejection reason is required', 400);
  }

  let detectedType = targetType;
  let vehicle = null;

  if (!detectedType || detectedType === 'commercial') {
    vehicle = await CommercialVehicle.findByPk(targetId);
    if (vehicle) detectedType = 'commercial';
  }

  if (!vehicle && (!detectedType || detectedType === 'car')) {
    vehicle = await Car.findByPk(targetId);
    if (vehicle) detectedType = 'car';
  }

  if (!vehicle) {
    throw new AppError('Listing not found', 404);
  }

  if (detectedType === 'commercial') {
    await vehicle.update({
      status: 'deleted',
      deleted_at: new Date(),
      rejection_reason: String(reason).trim(),
      approved_at: null,
      approved_by: adminId || null,
    });

    try {
      await Notification.create({
        user_id: vehicle.user_id,
        type: 'listing_rejected',
        message: `Your commercial vehicle listing was rejected: ${String(reason).trim()}`,
        target_type: 'commercial',
        target_id: vehicle.id,
        car_id: null,
      });
    } catch (notifErr) {
      console.warn('Failed to send rejection notification:', notifErr.message);
    }

    return {
      success: true,
      message: 'Commercial listing rejected.',
      listing: vehicle,
    };
  } else {
    await vehicle.update({
      status: 'deleted',
      deleted_at: new Date(),
    });

    try {
      await Notification.create({
        user_id: vehicle.user_id,
        type: 'listing_rejected',
        message: `Your car listing was rejected: ${String(reason).trim()}`,
        target_type: 'car',
        target_id: vehicle.id,
        car_id: vehicle.id,
      });
    } catch (notifErr) {
      console.warn('Failed to send car rejection notification:', notifErr.message);
    }

    return {
      success: true,
      message: 'Car listing rejected.',
      listing: vehicle,
    };
  }
};

