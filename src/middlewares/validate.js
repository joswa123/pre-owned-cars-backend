const { AppError } = require('../utils/errorHandler');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map(d => d.message);
      return next(new AppError(messages.join(', '), 400));
    }
    next();
  };
};

module.exports = validate;