const { Wishlist, Car, CarImage, User } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

/**
 * Add a car to wishlist
 */
exports.addToWishlist = async (userId, carId) => {
  // Check if car exists
  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found', 404);

  // Check if already in wishlist
  const existing = await Wishlist.findOne({ where: { user_id: userId, car_id: carId } });
  if (existing) throw new AppError('Car already in wishlist', 400);

  const wishlist = await Wishlist.create({ user_id: userId, car_id: carId });
  return wishlist;
};

/**
 * Remove a car from wishlist
 */
exports.removeFromWishlist = async (userId, carId) => {
  const wishlist = await Wishlist.findOne({ where: { user_id: userId, car_id: carId } });
  if (!wishlist) throw new AppError('Car not in wishlist', 404);
  await wishlist.destroy();
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
          { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
          { model: User, attributes: ['id', 'full_name', 'phone', 'profile_picture'] },
        ],
      }
    ],
    order: [['created_at', 'DESC']],
  });
  // Extract cars from wishlist entries
  return wishlist.map(w => w.Car);
};