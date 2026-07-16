const { User, Dealer, State, City } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { AppError } = require('../utils/errorHandler');
const { addDealerSchema, updateDealerSchema } = require('../validations/dealerValidation');

exports.createDealer = async (body, file) => {

    // Validation
    const { error } = addDealerSchema.validate(body, { abortEarly: false});

    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    // Duplicate Phone
    const phoneExists = await Dealer.findOne({
        where: { cp_phone: body.cp_phone }
    });

    if (phoneExists) {
        throw new AppError("Contact phone already exists.", 409);
    }

    // Duplicate Email
    const emailExists = await Dealer.findOne({
        where: { cp_email: body.cp_email }
    });

    if (emailExists) {
        throw new AppError("Contact email already exists.", 409);
    }

    // Duplicate GST
    const gstExists = await Dealer.findOne({
        where: { gst_no: body.gst_no }
    });

    if (gstExists) {
        throw new AppError("GST number already exists.", 409);
    }

    // Duplicate License
    const licenseExists = await Dealer.findOne({
        where: { license_no: body.license_no }
    });

    if (licenseExists) {
        throw new AppError("License number already exists.", 409);
    }

    // Create Dealer
    const dealer = await Dealer.create({
        user_id: body.user_id,
        company_name: body.company_name,
        license_no: body.license_no,
        gst_no: body.gst_no,
        contact_person: body.contact_person,
        cp_phone: body.cp_phone,
        cp_email: body.cp_email,
        cp_address: body.cp_address,
        cp_state_id: body.cp_state_id,
        cp_city_id: body.cp_city_id,
        cp_pincode: body.cp_pincode,
        company_logo: file
            ? `/uploads/dealer/${file.filename}`
            : null

    });

    return dealer;
};

exports.getDealer = async (id) => {

    const dealer = await Dealer.findByPk(id, {
        include: [
            { model: State, attributes: [ "id", "name" ]},
            { model: City, attributes: [ "id", "name" ]}
        ]
    });

    if (!dealer) {
        throw new AppError("Dealer not found.", 404);
    }

    return dealer;
};

exports.updateDealer = async (id, body, file) => {
    const { error } = updateDealerSchema.validate(body, { abortEarly: false });

    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    const dealer = await Dealer.findByPk(id);

    if (!dealer) {
        throw new AppError("Dealer not found.", 404);
    }

    // Duplicate Phone

    if (body.cp_phone) {

        const phoneExists = await Dealer.findOne({
            where: { cp_phone: body.cp_phone,
                id: {
                    [Op.ne]: id
                }
            }
        });

        if (phoneExists) {
            throw new AppError("Contact phone already exists.", 409);
        }

    }


    // Duplicate Email

    if (body.cp_email) {
        const emailExists = await Dealer.findOne({
            where: {
                cp_email: body.cp_email,
                id: {
                    [Op.ne]: id
                }
            }

        });

        if (emailExists) {
            throw new AppError("Contact email already exists.", 409);
        }
    }

    // Duplicate GST

    if (body.gst_no) {

        const gstExists = await Dealer.findOne({
            where: { gst_no: body.gst_no,
                id: {
                    [Op.ne]: id
                }
            }
        });

        if (gstExists) {
            throw new AppError("GST number already exists.", 409);
        }
    }

    // Duplicate License

    if (body.license_no) {
        const licenseExists = await Dealer.findOne({
            where: { license_no: body.license_no,
                id: {
                    [Op.ne]: id
                }
            }
        });

        if (licenseExists) {
            throw new AppError("License number already exists.", 409);
        }
    }

    // Update Object
    const updateData = {
        company_name: body.company_name,
        license_no: body.license_no,
        gst_no: body.gst_no,
        contact_person: body.contact_person,
        cp_phone: body.cp_phone,
        cp_email: body.cp_email,
        cp_address: body.cp_address,
        cp_state_id: body.cp_state_id,
        cp_city_id: body.cp_city_id,
        cp_pincode: body.cp_pincode
    };

    // Logo Upload
    if (file) {
        if (dealer.company_logo) {
            const oldImage = path.join(
                process.cwd(),
                dealer.company_logo.replace("/", "")
            );
            if (fs.existsSync(oldImage)) {
                fs.unlinkSync(oldImage);
            }
        }
        updateData.company_logo = `/uploads/dealer/${file.filename}`;
    }
    const updateDealer = await dealer.update(updateData);

    const updatedDealer = await Dealer.findByPk(id, {
        include: [
            { model: State, attributes: [ "id", "name" ]},
            { model: City, attributes: [ "id", "name" ]}
        ]
    });
    return updatedDealer;
};