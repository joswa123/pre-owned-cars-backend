const { User, Brand } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

exports.createBrand = async (brandData) => {
    const { user_id, brand_name, status } = brandData;