const { CarType } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.getAllCarTypes = async () => {
  return await CarType.findAll({ order: [['name', 'ASC']] });
};

exports.getCarTypeById = async (id) => {
  const carType = await CarType.findByPk(id);
  if (!carType) throw new AppError('Car type not found', 404);
  return carType;
};

exports.createCarType = async (data) => {
  const { name } = data;
  const existing = await CarType.findOne({ where: { name: name.trim().toLowerCase() } });
  if (existing) throw new AppError('Car type already exists', 400);

  const carType = await CarType.create({ name: name.trim() });
  return carType;
};

exports.updateCarType = async (id, data) => {
  const carType = await CarType.findByPk(id);
  if (!carType) throw new AppError('Car type not found', 404);

  if (data.name) {
      const normalizedName = name.trim().toLowerCase();

  const existing = await CarType.findOne({
    where: {
      name: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        normalizedName
      )
    }
  });
      if (existing && existing.id !== id) {
        throw new AppError('Car type name already exists', 400);
      }
  }

  await carType.update(data);
  return carType;
};

exports.deleteCarType = async (id) => {
  const carType = await CarType.findByPk(id);
  if (!carType) throw new AppError('Car type not found', 404);
  await carType.destroy();
  return { message: 'Car type deleted' };
};