const { User, DealerProfile, Car, CarImage, Brand, Model, Variant, State, District, City } = require('../models');
const { Op } = require('sequelize');
const { AppError } = require('../utils/errorHandler');

/**
 * Get active dealers with filters and pagination
 */
exports.getActiveDealers = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const where = {
    role: 'dealer',
    status: 'approved',
  };

  // Search by name or company name
  if (filters.name) {
    const search = `%${filters.name}%`;
    where[Op.or] = [
      { full_name: { [Op.like]: search } },
      { '$dealerProfile.company_name$': { [Op.like]: search } },
    ];
  }

  // Location filters
  if (filters.state_id) where.state_id = filters.state_id;
  if (filters.district_id) where.district_id = filters.district_id;
  if (filters.city_id) where.city_id = filters.city_id;

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture', 'state_id', 'district_id', 'city_id'],
    include: [
      {
        model: DealerProfile,
        as: 'dealerProfile',
        attributes: ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'verified'],
      },
      { model: State, as: 'stateDetail', attributes: ['name'] },
      { model: District, as: 'districtDetail', attributes: ['name'] },
      { model: City, as: 'cityDetail', attributes: ['name'] },
    ],
    limit: parseInt(limit),
    offset,
    order: [['full_name', 'ASC']],
  });

  // Transform to include location_text
  const dealers = rows.map(dealer => {
    const d = dealer.toJSON();
    d.location_text = [d.cityDetail?.name, d.districtDetail?.name, d.stateDetail?.name].filter(Boolean).join(', ');
    return d;
  });

  return {
    dealers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

/**
 * Get a single dealer by ID
 */
exports.getDealerById = async (dealerId) => {
  const dealer = await User.findOne({
    where: { id: dealerId, role: 'dealer', status: 'approved' },
    attributes: ['id', 'full_name', 'phone', 'email', 'profile_picture', 'state_id', 'district_id', 'city_id'],
    include: [
      {
        model: DealerProfile,
        as: 'dealerProfile',
        attributes: ['company_name', 'door_no', 'building_name', 'street_name', 'pincode', 'alt_phone', 'verified'],
      },
      { model: State, as: 'stateDetail', attributes: ['name'] },
      { model: District, as: 'districtDetail', attributes: ['name'] },
      { model: City, as: 'cityDetail', attributes: ['name'] },
    ],
  });

  if (!dealer) throw new AppError('Dealer not found', 404);

  const dealerJson = dealer.toJSON();
  dealerJson.location_text = [dealerJson.cityDetail?.name, dealerJson.districtDetail?.name, dealerJson.stateDetail?.name].filter(Boolean).join(', ');
  return dealerJson;
};

/**
 * Get active cars of a dealer with pagination
 */
exports.getDealerCars = async (dealerId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  // Verify dealer exists
  const dealer = await User.findOne({
    where: { id: dealerId, role: 'dealer', status: 'approved' },
    attributes: ['id'],
  });
  if (!dealer) throw new AppError('Dealer not found', 404);

  const { count, rows } = await Car.findAndCountAll({
    where: { user_id: dealerId, status: 'active' },
    include: [
      { model: CarImage, as: 'images', attributes: ['image_url', 'is_primary'] },
      { model: Brand, as: 'brand', attributes: ['id', 'name', 'logo'] },
      { model: Model, as: 'carModel', attributes: ['id', 'name'] },
      { model: Variant, as: 'carVariant', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
  });

  return {
    cars: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};
