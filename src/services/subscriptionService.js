// services/subscriptionService.js
const { Subscription, User } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database');

exports.getSellerSubscription = async (sellerId) => {
  const sub = await Subscription.findOne({
    where: { seller_id: sellerId, is_active: true },
    order: [['created_at', 'DESC']],
  });
  return sub;
};

exports.hasActiveSubscription = async (sellerId) => {
  const sub = await exports.getSellerSubscription(sellerId);
  if (!sub) return false;
  if (sub.end_date && new Date() > new Date(sub.end_date)) return false;
  return sub.is_active;
};

exports.createFreeTrial = async (sellerId) => {
  const existing = await Subscription.findOne({
    where: { seller_id: sellerId, plan: 'free_trial' },
  });
  if (existing) return existing; // already has trial

  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 3); // 3 months free

  const subscription = await Subscription.create({
    seller_id: sellerId,
    plan: 'free_trial',
    end_date: trialEnd,
    is_active: true,
  });
  return subscription;
};

exports.createPaidSubscription = async (sellerId, paymentData) => {
  const { payment_id, amount, plan } = paymentData;
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1); // 1 month

  const subscription = await Subscription.create({
    seller_id: sellerId,
    plan: plan || 'basic',
    start_date: new Date(),
    end_date: endDate,
    is_active: true,
    payment_id,
    amount_paid: amount,
    payment_status: 'success',
  });
  return subscription;
};