// services/leadService.js
const { Lead, Car, User, Subscription } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.createLead = async (carId, buyerData) => {
  const car = await Car.findByPk(carId);
  if (!car) throw new AppError('Car not found', 404);
  if (car.status !== 'active') throw new AppError('Car is not available', 400);

  const lead = await Lead.create({
    car_id: carId,
    seller_id: car.dealer_id,
    buyer_name: buyerData.name,
    buyer_phone: buyerData.phone,
    buyer_email: buyerData.email,
    message: buyerData.message,
  });
  return lead;
};

exports.getSellerLeads = async (sellerId) => {
  const leads = await Lead.findAll({
    where: { seller_id: sellerId },
    include: [
      { model: Car, attributes: ['id', 'brand', 'model', 'price'] },
    ],
    order: [['created_at', 'DESC']],
  });
  return leads.map(lead => {
    const data = lead.toJSON();
    // Mask buyer phone if not unlocked
    if (!data.contact_unlocked) {
      data.buyer_phone = data.buyer_phone.replace(/\d(?=\d{4})/g, 'X'); // show last 4 digits
    }
    return data;
  });
};

exports.unlockLead = async (leadId, sellerId) => {
  const lead = await Lead.findByPk(leadId, {
    include: [{ model: Car, as: 'car' }],
  });
  if (!lead) throw new AppError('Lead not found', 404);
  if (lead.seller_id !== sellerId) throw new AppError('Unauthorized', 403);

  // Check subscription
  const subscriptionService = require('./subscriptionService');
  const hasActive = await subscriptionService.hasActiveSubscription(sellerId);
  if (!hasActive) {
    throw new AppError('Active subscription required to unlock contacts', 402);
  }

  await lead.update({ contact_unlocked: true, unlocked_at: new Date() });
  return lead;
};