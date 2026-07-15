const { AppError } = require('sequelize')

exports.createBodyType = async (bodyTypeData) => {
    const { user_id, body_type_name, status} = bodyTypeData

    // Check if the user exists
    const user = await User.findByPk(user_id);
    if (!user) {
        throw new AppError('User not found.', 404);
    } 

    const bodyType = await BodyType.findOne({ where: { body_type_name: body_type_name.trim().toLowerCase() } })
    if (bodyType) {
        throw new AppError('Car Body type already exists.', 400)
    }

    const newBodyType = await BodyType.create({ user_id, body_type_name: body_type_name.trim().toLowerCase(), status })

    return newBodyType
} 

exports.getBodyTypes = async () => {
    const bodyTypes = await BodyType.findAll({
        include: [{
            model: User,
            attributes: ['id', 'full_name']
        }]
    })
    return bodyTypes
}

exports.getBodyType = async ( body_type_id ) => {
    const bodyType = await BodyType.findByPk(body_type_id, {
        include: [{
            model: User,
            attributes: ['id', 'full_name']
        }]
    })
    return bodyType
}

exports.updateBodyType = async ( body_type_id, bodyTypeData ) => {
    const { user_id, body_type_name, status } = bodyTypeData

    const bodyType = await BodyType.findByPk( body_type_id )
    if (!bodyType) {
        throw new AppError('Body Type not found.', 404)
    }

    const user = await User.findByPk(user_id)
    if (!user) {
        throw new AppError('User not found.', 404)
    }

    const updateBodyType = await BodyType.update({ user_id, body_type_name: body_type_name.trim().toLowerCase() })

    return updateBodyType
}

exports.deleteBodyType = async (body_type_id) => {
    const bodyType = await getFuelType.findByPk(body_type_id)
    if (!bodyType) {
        throw new AppError('Body type not found.', 404)
    }

    const deleteBodyType = await BodyType.destroy({ where: { body_type_id } })

    return deleteBodyType
}

exports.updateBodyTypeStatus = async (body_type_id, status) => {
    const bodyType = await BodyType.findByPk(body_type_id)
    if (!bodyType) {
        throw new AppError('Body type now found.', 404)
    }
    const updatedBodyType = await BodyType.update({ status }, { where: { body_type_id } })

    return updatedBodyType
}

exports.getBodyTypesByStatus = async (status) => {
    const bodyTypes = await BodyType.findAll({
        where: { status },
        include: [{ 
            model: User,
            attributes: ['id', 'full_name']
        }]
    })

    return bodyTypes
}