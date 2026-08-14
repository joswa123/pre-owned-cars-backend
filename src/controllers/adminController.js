// controllers/adminController.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { User, Lead, Car, Subscription, DealerProfile, CustomerProfile, Brand, Model } = require('../models');
const { catchAsync, AppError } = require('../utils/errorHandler');
const carService = require('../services/carService');

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
// Returns every lead with buyer (if registered) + car + seller info
exports.getAllEnquiries = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const whereClause = {};
  // Filter by viewed/unviewed status
  if (status === 'unread') whereClause.is_viewed = false;
  if (status === 'read') whereClause.is_viewed = true;
  if (status === 'unlocked') whereClause.contact_unlocked = true;

  // Search by buyer phone, name, or email (works for both guests and registered users)
  if (search) {
    whereClause[Op.or] = [
      { buyer_name: { [Op.like]: `%${search}%` } },
      { buyer_phone: { [Op.like]: `%${search}%` } },
      { buyer_email: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows: leads } = await Lead.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Car,
        as: 'car',
        attributes: ['id', 'title', 'price', 'status'],
        include: [
          {
            model: User,
            as: 'seller',
            attributes: ['id', 'full_name', 'phone', 'email', 'role'],
          },
        ],
      },
      {
        model: User,
        as: 'buyer',
        attributes: ['id', 'full_name', 'phone', 'email'],
        required: false, // LEFT JOIN — guests have no buyer record
      },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
  });

  res.json({
    success: true,
    data: {
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
      leads,
    },
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