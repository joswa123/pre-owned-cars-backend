const { Transmission, User } = require('../models');
const { AppError } = require('../utils/errorHandler');
const sequelize = require('../config/database'); 
exports.createTransmission = async (transmissionData) => {
    const { user_id, transmission_name, status } = transmissionData;

    const user = await User.findByPk(user_id);
    if (!user) throw new AppError('User not found.', 404);

     const normalizedName = transmission_name.trim().toLowerCase();

  const existing = await Transmission.findOne({
    where: {
      transmission_name: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('transmission_name')),
        normalizedName
      )
    }
  });
  
    if (existing) throw new AppError('Transmission already exists.', 400);

    const newTransmission = await Transmission.create({
        user_id,
        transmission_name: transmission_name.trim().toLowerCase(),
        status
    });
    return newTransmission;
};

exports.getTransmissions = async () => {
    const transmissions = await Transmission.findAll({
        include: [{
            model: User,
            as: 'creator',          // ✅ alias
            attributes: ['id', 'full_name']
        }],
        order: [['transmission_name', 'ASC']]
    });
    return transmissions;
};

exports.getTransmission = async (transmission_id) => {
    const transmission = await Transmission.findByPk(transmission_id, {
        include: [{
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name']
        }]
    });
    if (!transmission) throw new AppError('Transmission not found.', 404);
    return transmission;
};

exports.updateTransmission = async (transmission_id, transmissionData) => {
    const { user_id, transmission_name, status } = transmissionData;

    const transmission = await Transmission.findByPk(transmission_id);
    if (!transmission) throw new AppError('Transmission not found.', 404);

    const user = await User.findByPk(user_id);
    if (!user) throw new AppError('User not found.', 404);

    const updated = await Transmission.update(
        {
            user_id,
            transmission_name: transmission_name.trim().toLowerCase(),
            status
        },
        { where: { transmission_id } }
    );
    return updated;
};

exports.deleteTransmission = async (transmission_id) => {
    const transmission = await Transmission.findByPk(transmission_id);
    if (!transmission) throw new AppError('Transmission not found.', 404);
    await Transmission.destroy({ where: { transmission_id } });
    return { message: 'Transmission deleted' };
};

exports.updateTransmissionStatus = async (transmission_id, status) => {
    const transmission = await Transmission.findByPk(transmission_id);
    if (!transmission) throw new AppError('Transmission not found.', 404);
    await Transmission.update({ status }, { where: { transmission_id } });
    return { message: 'Status updated' };
};

exports.getTransmissionsByStatus = async (status) => {
    const transmissions = await Transmission.findAll({
        where: { status },
        include: [{
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name']
        }]
    });
    return transmissions;
};