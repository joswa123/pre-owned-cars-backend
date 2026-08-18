const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { globalErrorHandler } = require('./utils/errorHandler');
const logger = require('./utils/logger');
const { cacheMiddleware } = require('./middlewares/cacheMiddleware');
const morgan = require('morgan');

const app = express();

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: { write: message => logger.info(message.trim()) }
}));

// ─── Trust Proxy (required for Render/Heroku) ────────────────────────────────
app.set('trust proxy', 1);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

// Single, correctly configured CORS (don't use cors() twice)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'X-Requested-With', 'Accept'],
  credentials: true,
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Compression (Gzip/Brotli for Flutter & Web) ──────────────────────────────
app.use(compression({
  threshold: 256, // Compress responses larger than 256 bytes
  level: 6,       // Optimal balance between CPU usage and compression size
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// ─── Static Uploads ──────────────────────────────────────────────────────────
// Render has a persistent disk if configured, otherwise use local uploads folder.
// Do NOT route to /tmp here — Render is NOT Vercel. /tmp files are not served.
const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '..', 'uploads');

// Ensure the uploads directory exists at startup so static serving doesn't fail
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`📁 Created uploads directory: ${uploadDir}`);
  }
} catch (err) {
  logger.warn(`⚠️  Could not create uploads directory: ${err.message}`);
}

app.use('/uploads', express.static(uploadDir));

// ─── Debug Endpoint ──────────────────────────────────────────────────────────
app.get('/api/debug/uploads', (req, res) => {
  const brandsDir = path.join(uploadDir, 'brands');
  const getDirContents = (dir) => {
    try {
      if (fs.existsSync(dir)) {
        return { exists: true, files: fs.readdirSync(dir) };
      }
      return { exists: false, reason: 'Directory does not exist' };
    } catch (error) {
      return { exists: true, error: error.message };
    }
  };
  res.json({
    success: true,
    uploadDir,
    brands: { directory: brandsDir, ...getDirContents(brandsDir) },
  });
});

// ─── Diagnostic Routes ───────────────────────────────────────────────────────
// GET /health — Used by Render and Nginx to check if this instance is alive.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// GET /server-id — Shows which instance handled this request.
// Hit this endpoint multiple times to verify load-balancing is working:
// each replica will return a different pid / hostname.
app.get('/server-id', (req, res) => {
  res.status(200).json({
    pid:      process.pid,          // unique per Node.js process
    hostname: os.hostname(),        // unique per container / Render instance
    env:      process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', require('./routes/v1/authRoutes'));
app.use('/api/v1/users', require('./routes/v1/userRoutes'));
app.use('/api/v1/dealers', require('./routes/v1/dealerRoutes'));
// Apply 60s cache for public car listings (GET only)
app.use('/api/v1/cars', require('./routes/v1/carRoutes'));
// Apply 5m cache for location metadata
app.use('/api/v1/locations', cacheMiddleware(300, { ignoreAuth: true }), require('./routes/v1/locationRoutes'));
// Apply 5m cache for vehicle metadata
app.use('/api/v1/fuel-types', cacheMiddleware(300, { ignoreAuth: true }), require('./routes/v1/fuelTypeRoutes'));
app.use('/api/v1/transmissions', cacheMiddleware(300, { ignoreAuth: true }), require('./routes/v1/transmissionRoutes'));
app.use('/api/v1/models', cacheMiddleware(300, { ignoreAuth: true }), require('./routes/v1/modelRoutes'));
app.use('/api/v1/variants', cacheMiddleware(300, { ignoreAuth: true }), require('./routes/v1/variantRoutes'));
app.use('/api/v1/car-types', cacheMiddleware(300, { ignoreAuth: true }), require('./routes/v1/carTypeRoutes'));
app.use('/api/v1/catalog', require('./routes/v1/catalogRoutes'));
app.use('/api/v1/wishlist', require('./routes/v1/wishlistRoutes'));
app.use('/api/v1/leads', require('./routes/v1/leadRoutes'));
app.use('/api/v1/subscriptions', require('./routes/v1/subscriptionRoutes'));
app.use('/api/v1/banners', require('./routes/v1/bannerRoutes'));
app.use('/api/v1/requirements', require('./routes/v1/requirementRoutes'));
// ── Admin Routes (protected — admin role required) ───────────────────────────
app.use('/api/v1/admin', require('./routes/v1/adminRoutes'));
app.use('/api/v1/admin/banners', require('./routes/v1/admin/bannerRoutes'));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler (must be LAST) ─────────────────────────────────────
app.use(globalErrorHandler);

module.exports = app;