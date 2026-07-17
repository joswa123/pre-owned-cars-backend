const { FuelType, User } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.createFuelType = async (fuelTypeData) => {
    const { user_id, fuel_type_name, status } = fuelTypeData;

    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    }
 const normalizedName = fuel_type_name.trim().toLowerCase();

  // ✅ Check case‑insensitively
  const existing = await FuelType.findOne({
    where: {
      fuel_type_name: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('fuel_type_name')),
        normalizedName
      )
    }
  });
    if (existing) {
        throw new AppError('Fuel type already exists.', 400);
    }

    const newFuelType = await FuelType.create({
        user_id,
        fuel_type_name: fuel_type_name.trim().toLowerCase(),
        status
    });
    return newFuelType;
};

exports.getFuelTypes = async () => {
    const fuelTypes = await FuelType.findAll({
        include: [{
            model: User,
            as: 'creator',              // ✅ add alias here
            attributes: ['id', 'full_name']
        }]
    });
    return fuelTypes;
};

exports.getFuelType = async (fuel_type_id) => {
    const fuelType = await FuelType.findByPk(fuel_type_id, {
        include: [{
            model: User,
            as: 'creator',              // ✅ add alias here
            attributes: ['id', 'full_name']
        }]
    });
    if (!fuelType) {
        throw new AppError('Fuel type not found.', 404);
    }
    return fuelType;
};

exports.updateFuelType = async (fuel_type_id, fuelTypeData) => {
    const { user_id, fuel_type_name, status } = fuelTypeData;
const normalizedName = fuel_type_name.trim().toLowerCase();

  const existing = await FuelType.findOne({
    where: {
      fuel_type_name: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('fuel_type_name')),
        normalizedName
      ),
      fuel_type_id: { [Op.ne]: fuel_type_id } // exclude current
    }
  });
  if(existing){
    throw new AppError('Fuel type already exists.', 400);
  }

    const fuelType = await FuelType.findByPk(fuel_type_id);
    if (!fuelType) {
        throw new AppError('Fuel type not found.', 404);
    }

    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const updated = await FuelType.update(
        {
            user_id,
            fuel_type_name: fuel_type_name.trim().toLowerCase(),
            status
        },
        { where: { fuel_type_id } }
    );
    return updated;
};

exports.deleteFuelType = async (fuel_type_id) => {
    const fuelType = await FuelType.findByPk(fuel_type_id);
    if (!fuelType) {
        throw new AppError('Fuel type not found.', 404);
    }
    const deleted = await FuelType.destroy({ where: { fuel_type_id } });
    return deleted;
};

exports.updateFuelTypeStatus = async (fuel_type_id, status) => {
    const fuelType = await FuelType.findByPk(fuel_type_id);
    if (!fuelType) {
        throw new AppError('Fuel type not found.', 404);
    }
    const updated = await FuelType.update({ status }, { where: { fuel_type_id } });
    return updated;
};

exports.getFuelTypesByStatus = async (status) => {
    const fuelTypes = await FuelType.findAll({
        where: { status },
        include: [{
            model: User,
            as: 'creator',              // ✅ add alias here
            attributes: ['id', 'full_name']
        }]
    });
    return fuelTypes;
};