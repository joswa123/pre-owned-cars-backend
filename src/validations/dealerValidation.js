const Joi = require('joi');

const addDealerSchema = Joi.object({
    user_id: Joi.string().guid({ version: 'uuidv4' }).required(),
    company_name: Joi.string().max(200).required(),
    license_no: Joi.string().max(200).optional(),
    gst_no: Joi.string().max(100).optional(),
    contact_person: Joi.string().max(100).optional(),
    cp_phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    cp_email: Joi.string().email().optional(),
    cp_address: Joi.string().optional(),
    cp_city_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
    cp_state_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
    cp_pincode: Joi.string().pattern(/^[0-9]{6}$/).optional(),
    company_logo: Joi.string().max(255).allow(null, '').optional()
});
 
const updateDealerSchema = Joi.object({
    user_id: Joi.string().guid({ version: 'uuidv4' }).required(),
    company_name: Joi.string().max(200).required(),
    license_no: Joi.string().max(200).optional(),
    gst_no: Joi.string().max(100).optional(),
    contact_person: Joi.string().max(100).optional(),
    cp_phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
    cp_email: Joi.string().email().optional(),
    cp_address: Joi.string().optional(),
    cp_city_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
    cp_state_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
    cp_pincode: Joi.string().pattern(/^[0-9]{6}$/).optional(),
    company_logo: Joi.string().max(255).allow(null, '').optional() 
})

module.exports = { addDealerSchema, updateDealerSchema };