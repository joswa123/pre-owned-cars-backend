const { AppError } = require('../utils/appError');

exports.createTransmission = async (transmissionData) => {
    const { user_id, transmission_name, status } = transmissionData;

    // Check if the user exists
    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const transmission = await Transmission.findOne({ where: { transmission_name: transmission_name.trim().toLowerCase() } });
    if (transmission) {
        throw new AppError('Transmission already exists.', 400);
    }

    const newTransmission = await Transmission.create({ user_id, transmission_name: transmission_name.trim().toLowerCase(), status });

    return newTransmission;
}

exports.getTransmissions = async () => {
    const transmissions = await Transmission.findAll({
        include: [{
            model: User,
            attributes: ['id', 'full_name'] // Adjust attributes as needed
        }]
    });
    return transmissions;
}

exports.getTransmission = async (transmission_id) => {
    const transmission = await Transmission.findByPk(transmission_id, {
        include: [{
            model: User,
            attributes: ['id', 'full_name'] // Adjust attributes as needed
        }]
    });
    return transmission;
}

exports.updateTransmission = async (transmission_id, transmissionData) => {
    const { user_id, transmission_name, status } = transmissionData;

    const transmission = await Transmission.findByPk(transmission_id);
    if (!transmission) {
        throw new AppError('Transmission not found.', 404);
    }

    // Check if the user exists
    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    }

    const updatedTransmission = await Transmission.update({ user_id, transmission_name: transmission_name.trim().toLowerCase(), status }, { where: { transmission_id } });

    return updatedTransmission;
}

exports.deleteTransmission = async (transmission_id) => {
    const transmission = await Transmission.findByPk(transmission_id);
    if (!transmission) {
        throw new AppError('Transmission not found.', 404);
    }

    const deletedTransmission = await Transmission.destroy({ where: { transmission_id } });
    
    return deletedTransmission;
}

exports.updateTransmissionStatus = async (transmission_id, status) => {
    const transmission = await Transmission.findByPk(transmission_id);
    if (!transmission) {
        throw new AppError('Transmission not found.', 404);
    }

    const updatedTransmission = await Transmission.update({ status }, { where: { transmission_id } });

    return updatedTransmission;
}

exports.getTransmissionsByStatus = async (status) => {
    const transmissions = await Transmission.findAll({
        where: { status },
        include: [{
            model: User,
            attributes: ['id', 'full_name']
        }]
    });
    return transmissions;
}
