// controllers/adminController.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Lead, Car, Subscription, DealerProfile, CustomerProfile, Brand, Model } = require('../models');
const { catchAsync, AppError } = require('../utils/errorHandler');
const carService = require('../services/carService');
const leadService = require('../services/leadService');

// ── Traffic Stats ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/traffic
// Returns registered user counts + guest-enquiry (no user_id) counts
exports.getTrafficStats = catchAsync(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    usersToday,
    usersThisWeek,
    usersThisMonth,
    totalDealers,
    totalCustomers,
    totalEnquiries,
    guestEnquiries,
    enquiriesToday,
    enquiriesThisWeek,
    totalCars,
    activeCars,
  ] = await Promise.all([
    User.count(),
    User.count({ where: { created_at: { [Op.gte]: startOfToday } } }),
    User.count({ where: { created_at: { [Op.gte]: startOfWeek } } }),
    User.count({ where: { created_at: { [Op.gte]: startOfMonth } } }),
    User.count({ where: { role: 'dealer' } }),
    User.count({ where: { role: 'customer' } }),
    Lead.count(),
    Lead.count({ where: { buyer_id: null } }),
    Lead.count({ where: { created_at: { [Op.gte]: startOfToday } } }),
    Lead.count({ where: { created_at: { [Op.gte]: startOfWeek } } }),
    Car.count(),
    Car.count({ where: { status: 'active' } }),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        dealers: totalDealers,
        customers: totalCustomers,
        registered_today: usersToday,
        registered_this_week: usersThisWeek,
        registered_this_month: usersThisMonth,
      },
      enquiries: {
        total: totalEnquiries,
        from_registered_users: totalEnquiries - guestEnquiries,
        from_guests: guestEnquiries,
        today: enquiriesToday,
        this_week: enquiriesThisWeek,
      },
      cars: {
        total: totalCars,
        active: activeCars,
        inactive: totalCars - activeCars,
      },
    },
  });
});

// ── All Enquiries ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/enquiries
// Returns every lead with buyer + car + seller info
exports.getAllEnquiries = catchAsync(async (req, res) => {
  const result = await leadService.getAllLeadsForAdmin(req.query);
  res.json({
    status: 'success',
    data: result,
  });
});

// ── Dealers ──────────────────────────────────────────────────────────────────
// GET /api/v1/admin/dealers
// Returns paginated dealer list with their full DealerProfile. Admin use only.
exports.getDealers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const where = { role: 'dealer' };

  if (status) where.status = status;

  if (search) {
    where[Op.or] = [
      { full_name: { [Op.like]: `%${search}%` } },
      { phone:     { [Op.like]: `%${search}%` } },
      { email:     { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      {
        model: DealerProfile,
        as: 'dealerProfile',
        required: false, // LEFT JOIN — include dealers even if profile is incomplete
      },
    ],
    attributes: { exclude: ['password_hash'] },
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    distinct: true, // Required for accurate count with LEFT JOIN
  });

  res.json({
    status: 'success',
    data: {
      dealers: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

// GET /api/v1/admin/dealers/:id
// Returns a single dealer's full profile for admin detail view.
exports.getDealerById = catchAsync(async (req, res) => {
  const dealer = await User.findOne({
    where: { id: req.params.id, role: 'dealer' },
    include: [
      {
        model: DealerProfile,
        as: 'dealerProfile',
        required: false,
      },
    ],
    attributes: { exclude: ['password_hash'] },
  });

  if (!dealer) {
    throw new AppError('Dealer not found', 404);
  }

  res.json({ status: 'success', data: { dealer } });
});

// GET /api/v1/admin/dealers/:dealerId/cars
// Returns all cars belonging to a specific dealer for admin view
exports.getDealerCars = catchAsync(async (req, res) => {
  const { dealerId } = req.params;
  const dealer = await User.findOne({ where: { id: dealerId, role: 'dealer' } });
  
  if (!dealer) {
    throw new AppError('Dealer not found', 404);
  }

  const cars = await carService.getUserCars(dealerId);
  res.json({ status: 'success', data: { cars } });
});

// ── Subscriptions (future) ────────────────────────────────────────────────────
exports.getSubscriptions = catchAsync(async (req, res) => {
  const subs = await Subscription.findAll({
    include: [{ model: User, attributes: ['id', 'full_name', 'phone'] }],
    order: [['created_at', 'DESC']],
  });
  res.json({ success: true, data: subs });
});

// ── Payments (future) ─────────────────────────────────────────────────────────
exports.getPayments = catchAsync(async (req, res) => {
  const payments = await Subscription.findAll({
    where: { payment_status: 'success' },
    attributes: ['payment_id', 'amount_paid', 'created_at', 'seller_id'],
  });
  res.json({ success: true, data: payments });
});

// ── Pending Users Approval Flow ───────────────────────────────────────────────
// GET /api/v1/admin/users/pending/count
// Returns total count of users with status = 'pending'
exports.getPendingUsersCount = catchAsync(async (req, res) => {
  const count = await User.count({
    where: { status: 'pending' },
  });
  res.json({
    status: 'success',
    data: { count },
  });
});

// GET /api/v1/admin/users/pending
// Returns paginated list of pending users with optional search filter
exports.getPendingUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const where = { status: 'pending' };

  if (search) {
    where[Op.or] = [
      { full_name: { [Op.like]: `%${search}%` } },
      { phone:     { [Op.like]: `%${search}%` } },
      { email:     { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      {
        model: CustomerProfile,
        as: 'customerProfile',
        required: false,
      },
      {
        model: DealerProfile,
        as: 'dealerProfile',
        required: false,
      },
    ],
    attributes: { exclude: ['password_hash'] },
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    distinct: true,
  });

  res.json({
    status: 'success',
    data: {
      users: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

// PATCH /api/v1/admin/users/:id/approve (also supports :userId)
// Approves a user account
exports.approveUser = catchAsync(async (req, res) => {
  const userId = req.params.id || req.params.userId;
  const user = await User.findByPk(userId, {
    include: [
      { model: CustomerProfile, as: 'customerProfile', required: false },
      { model: DealerProfile, as: 'dealerProfile', required: false },
    ],
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  await user.update({ status: 'approved' });

  const userData = user.toJSON();
  delete userData.password_hash;

  res.json({
    status: 'success',
    message: 'User approved successfully',
    data: { user: userData },
  });
});

// PATCH /api/v1/admin/users/:id/reject (also supports :userId)
// Rejects a user account with optional reason
exports.rejectUser = catchAsync(async (req, res) => {
  const userId = req.params.id || req.params.userId;
  const { reason } = req.body || {};

  const user = await User.findByPk(userId, {
    include: [
      { model: CustomerProfile, as: 'customerProfile', required: false },
      { model: DealerProfile, as: 'dealerProfile', required: false },
    ],
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  await user.update({ status: 'rejected' });

  const userData = user.toJSON();
  delete userData.password_hash;

  res.json({
    status: 'success',
    message: 'User rejected successfully',
    data: {
      user: userData,
      ...(reason && { rejection_reason: reason }),
    },
  });
});