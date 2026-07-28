// controllers/subscriptionController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const subscriptionService = require('../services/subscriptionService');
const { catchAsync } = require('../utils/errorHandler');
const { sendEmail } = require('../utils/email');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.getStatus = catchAsync(async (req, res) => {
  const sub = await subscriptionService.getSellerSubscription(req.user.id);
  res.json({ success: true, data: sub });
});

exports.createSubscription = catchAsync(async (req, res) => {
  const { plan = 'basic', amount = 999 } = req.body; // ₹999/month

  const options = {
    amount: amount * 100, // amount in paise
    currency: 'INR',
    receipt: `sub_${Date.now()}`,
    notes: {
      seller_id: req.user.id,
      plan,
    },
  };
  const order = await razorpay.orders.create(options);
  res.json({ success: true, data: order });
});

exports.verifyPayment = catchAsync(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  // Payment successful
  const subscription = await subscriptionService.createPaidSubscription(req.user.id, {
    payment_id: razorpay_payment_id,
    amount: 999,
    plan: 'basic',
  });

  // Send email confirmation
  await sendEmail({
    to: req.user.email,
    subject: 'Subscription Activated – AutoDeal',
    text: `Your subscription is now active. You can unlock buyer contacts.`,
  });

  // Notify admin (email or in-app)
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `New Subscription – Seller ${req.user.id}`,
    text: `Payment ID: ${razorpay_payment_id}`,
  });

  res.json({ success: true, data: subscription });
});