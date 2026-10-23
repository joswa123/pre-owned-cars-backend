class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  // 1. Map JWT verification errors to 401 Unauthorized
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
  } else if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
  }

  // 2. Map Multer errors to 400 / 413
  else if (err.name === 'MulterError' || err.code?.startsWith?.('LIMIT_')) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const field = err.field;
      let limitDesc = '10MB for images, 20MB for audio, 100MB for video';
      if (field === 'video') limitDesc = '100MB';
      else if (field === 'audio') limitDesc = '20MB';
      else if (field === 'primary_image' || field === 'images' || field === 'image' || field === 'icon' || field === 'profile_picture' || field === 'customerProfile' || field === 'dealerProfile') limitDesc = '5MB';
      error = new AppError(`File size exceeds allowable limit (${limitDesc}) for field "${field || 'file'}".`, 413, 'FILE_TOO_LARGE');
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const maxCarImages = parseInt(process.env.MAX_CAR_IMAGES, 10) || 20;
      const fieldMaxCounts = {
        primary_image: 1,
        images: maxCarImages,
        video: 1,
        audio: 1,
        profile_picture: 1,
        customerProfile: 1,
        dealerProfile: 1,
        image: 1,
        icon: 1,
      };

      if (err.field && fieldMaxCounts[err.field] !== undefined) {
        error = new AppError(`Too many files uploaded for field "${err.field}". Maximum allowed is ${fieldMaxCounts[err.field]}.`, 400, 'TOO_MANY_FILES');
      } else {
        error = new AppError(`Unexpected field "${err.field}". Allowed file fields: primary_image, images, video, audio.`, 400, 'UNEXPECTED_FILE');
      }
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      error = new AppError(`Too many files uploaded for field "${err.field || 'files'}".`, 400, 'TOO_MANY_FILES');
    } else {
      error = new AppError(`File upload error: ${err.message}`, 400, 'UPLOAD_ERROR');
    }
  }

  // 3. Map Cloudinary errors to informative AppErrors
  else if (err.http_code || (err.message && /cloudinary|cloud_name|api_key|api_secret/i.test(err.message))) {
    console.error('❌ Cloudinary Service Error:', err);
    error = new AppError(`Media upload failed: ${err.message || 'Cloudinary service error'}`, err.http_code || 400, 'UPLOAD_FAILED');
  }

  // 4. Map Sequelize Database Errors
  else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = new AppError('Foreign key constraint error: Brand, Model, Variant, or Location not found in database.', 400, 'FOREIGN_KEY_ERROR');
  } else if (err.name === 'SequelizeValidationError') {
    error = new AppError(err.errors?.[0]?.message || 'Database validation error', 400, 'VALIDATION_ERROR');
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    const isCategory = /car_types|category/i.test(err.parent?.table || err.message || '');
    error = new AppError(
      isCategory ? 'Category name or slug already exists.' : 'Duplicate record detected in database.',
      isCategory ? 409 : 400,
      isCategory ? 'CATEGORY_NAME_TAKEN' : 'DUPLICATE_RECORD'
    );
  } else if (err.name === 'SequelizeDatabaseError') {
    console.error('❌ Sequelize Database Error:', err);
    const isMissingColumn = /unknown column/i.test(err.message) || /column.*does not exist/i.test(err.message);
    if (isMissingColumn) {
      error = new AppError(`Database schema error: Missing table column. Please ensure database migrations have been executed. (${err.message})`, 500, 'SCHEMA_ERROR');
      error.isOperational = true;
    } else {
      error = new AppError(`Database query error: ${err.message}`, 500, 'DB_ERROR');
      error.isOperational = true;
    }
  }

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  if (error.statusCode === 503 && error.retryAfter) {
    res.set('Retry-After', String(error.retryAfter));
  }

  const standardErrorObject = {
    code: error.code || (error.statusCode === 404 ? 'NOT_FOUND' : (error.statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR')),
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  };

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    res.status(error.statusCode).json({
      status: error.status,
      success: false,
      message: error.message,
      error: standardErrorObject,
      stack: error.stack,
    });
  } else {
    // Production
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        success: false,
        message: error.message,
        error: standardErrorObject,
      });
    } else {
      console.error('ERROR 💥', error);
      res.status(500).json({
        status: 'error',
        success: false,
        message: error.message || 'Something went wrong!',
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Something went wrong!',
        },
      });
    }
  }
};

module.exports = {
  AppError,
  catchAsync,
  globalErrorHandler,
};