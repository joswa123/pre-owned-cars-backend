const { User, State, City } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { AppError } = require('../utils/errorHandler');
const { updateProfileSchema } = require('../validations/userValidation');

exports.updateProfile = async (id, body, file) => {

    // Validate Request
    const { error } = updateProfileSchema.validate(body, { abortEarly: false });

    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    // Find User
    const user = await User.findByPk(id);

    if (!user) {
        throw new AppError("User not found.", 404);
    }

    // Check Duplicate Phone
    if (body.phone) {

        const phoneExists = await User.findOne({
            where: {
                phone: body.phone,
                id: {
                    [Op.ne]: id
                }
            }
        });

        if (phoneExists) {
            throw new AppError("Phone number already exists.", 409);
        }
    }

    // Check Duplicate Email
    if (body.email) {

        const emailExists = await User.findOne({
            where: {
                email: body.email.toLowerCase().trim(),
                id: {
                    [Op.ne]: id
                }
            }
        });

        if (emailExists) {
            throw new AppError("Email already exists.", 409);
        }
    }

    // Build Update Object
    const updateData = {};

    if (body.full_name !== undefined)
        updateData.full_name = body.full_name.trim();

    if (body.phone !== undefined)
        updateData.phone = body.phone;

    if (body.email !== undefined)
        updateData.email = body.email.toLowerCase().trim();

    if (body.address !== undefined)
        updateData.address = body.address.trim();

    if (body.state_id !== undefined)
        updateData.state_id = body.state_id;

    if (body.city_id !== undefined)
        updateData.city_id = body.city_id;

    if (body.pincode !== undefined)
        updateData.pincode = body.pincode;

    if (body.aadhaar !== undefined)
        updateData.aadhaar = body.aadhaar;

    if (file) {
        if (user.profile_picture) {

            const oldImage = path.join(
                process.cwd(),
                user.profile_picture.replace(/^\//, "")
            );

            if (fs.existsSync(oldImage)) {
                fs.unlinkSync(oldImage);
            }
        }

        updateData.profile_picture = `/uploads/user/${file.filename}`;
    }

    // Update User
    await user.update(updateData);

    // Return Updated Profile
    const updatedUser = await User.findByPk(id, {
        attributes: {
            exclude: ["password_hash"]
        },
        include: [
            {
                model: State,
                attributes: ["id", "name"]
            },
            {
                model: City,
                attributes: ["id", "name"]
            }
        ]
    });

    return updatedUser;
};

exports.getProfile = async (id) => {

    const user = await User.findByPk(id, {
        attributes: {
            exclude: ["password_hash"]
        },
        include: [
            {
                model: State,
                attributes: ["id", "name"]
            },
            {
                model: City,
                attributes: ["id", "name"]
            }
        ]
    });

    if (!user) {
        throw new AppError("User not found.", 404);
    }

    return user;
};
