const { AppError } = require('../utils/errorHandler');

const validate = (schema, options = {}) => {
  return (req, res, next) => {
    if (!schema) {
      return res.status(500).json({ success: false, message: 'Validation schema is missing.' });
    }
    const { error, value } = schema.validate(req.body, { allowUnknown: true, ...options });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    req.body = value;
    next();
  };
};

module.exports = validate;

