const { AppError } = require('../utils/errorHandler');

const validate = (schema) => {
  return (req, res, next) => {
    if (!schema) {
      return res.status(500).json({ success: false, message: 'Validation schema is missing.' });
    }
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    next();
  };
};

module.exports = validate;

