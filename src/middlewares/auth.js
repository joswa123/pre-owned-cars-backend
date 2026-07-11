const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('You are not logged in. Please log in.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);  // ✅ now User is defined

    if (!user) {
      throw new AppError('User no longer exists.', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};