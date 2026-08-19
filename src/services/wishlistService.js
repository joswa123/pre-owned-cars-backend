const { Wishlist, Car, CarImage, User, District, DealerProfile, Brand, Model, Variant, State, City } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

/**
 * Add a car to wishlist
 */
exports.addToWishlist = async (userId, carId) => {
  try {
    const wishlist = await Wishlist.create({ user_id: userId, car_id: carId });
    return wishlist;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError('Car already in wishlist', 400);
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new AppError('Car not found', 404);
    }
    throw error;
  }
};

/**
 * Remove a car from wishlist
 */
exports.removeFromWishlist = async (userId, carId) => {
  const deletedCount = await Wishlist.destroy({ where: { user_id: userId, car_id: carId } });
  if (deletedCount === 0) throw new AppError('Car not in wishlist', 404);
  return { success: true };
};

/**
 * Get user's wishlist with car details
 */
exports.getWishlist = async (userId) => {
  const wishlist = await Wishlist.findAll({
    where: { user_id: userId },
    include: [
      {
        model: Car,
        include: [
          { model: CarImage, as: 'images', attributes: ['id', 'image_url', 'is_primary'] },
          {
            model: User,
            as: 'seller',
            attributes: ['id', 'full_name', 'phone', 'email', 'role', 'city', 'state', 'profile_picture'],
            include: [
              { model: District, as: 'district', attributes: ['name'] },
              { model: DealerProfile, as: 'dealerProfile', attributes: ['company_name'] },
            ],
          },
          { model: Brand, as: 'brand', attributes: ['id', 'name'] },
          { model: Model, as: 'carModel', attributes: ['id', 'name'] },
          { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
          { model: State, as: 'state', attributes: ['id', 'name'] },
          { model: District, as: 'district', attributes: ['id', 'name'] },
          { model: City, as: 'city', attributes: ['id', 'name'] },
        ],
      }
    ],
    order: [['created_at', 'DESC']],
  });
  // Extract cars from wishlist entries
  return wishlist.map(w => w.Car);
};