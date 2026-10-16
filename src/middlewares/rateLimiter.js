const rateLimit = require('express-rate-limit');

// Public API limiter: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for dealer car filters: max 60 requests per minute per IP + dealerId
const dealerFilterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `${req.ip || 'ip'}_${req.params.id || 'all'}`,
  message: {
    status: 'error',
    message: 'Too many filter requests for this dealer. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { limiter, dealerFilterLimiter };
