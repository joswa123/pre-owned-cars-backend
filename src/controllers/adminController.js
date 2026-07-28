// controllers/adminController.js (add these)
const sequelize = require('../config/database');
const { Subscription, User } = require('../models');
const { catchAsync } = require('../utils/errorHandler');

exports.getSubscriptions = catchAsync(async (req, res) => {
  const subs = await Subscription.findAll({
    include: [{ model: User, attributes: ['id', 'full_name', 'phone'] }],
    order: [['created_at', 'DESC']],
  });
  res.json({ success: true, data: subs });
});

exports.getPayments = catchAsync(async (req, res) => {
  // You can add a separate Payment model or use subscription.payment_id
  const payments = await Subscription.findAll({
    where: { payment_status: 'success' },
    attributes: ['payment_id', 'amount_paid', 'created_at', 'seller_id'],
  });
  res.json({ success: true, data: payments });
});