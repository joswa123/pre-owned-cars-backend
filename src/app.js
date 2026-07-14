const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { globalErrorHandler } = require('./utils/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Security
app.use(helmet());
app.use(cors());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());
const path = require('path');
const os = require('os');
const fs = require('fs');

// Serve from standard root uploads folder (local)
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Fallback: serve from dynamic temp directory (Vercel)
const tempUploadsPath = path.join(os.tmpdir(), 'uploads');
app.use('/uploads', express.static(tempUploadsPath));

// Debug endpoint to check upload directory contents
app.get('/api/debug/uploads', (req, res) => {
  const brandsDir = path.join(uploadsPath, 'brands');
  const tempBrandsDir = path.join(tempUploadsPath, 'brands');
  
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
    local: { directory: brandsDir, ...getDirContents(brandsDir) },
    temp: { directory: tempBrandsDir, ...getDirContents(tempBrandsDir) }
  });
});
// Routes
app.use('/api/v1/auth', require('./routes/v1/authRoutes'));
app.use('/api/v1/users', require('./routes/v1/userRoutes'));
app.use('/api/v1/cars', require('./routes/v1/carRoutes'));
app.use('/api/v1/location', require('./routes/v1/locationRoutes'));

app.use('/api/v1/admin', require('./routes/v1/adminRoutes'));
// Public brand routes (no auth)
app.use('/api/v1/brands', require('./routes/v1/brandRoutes'))
// other routes later...
// Public fuel type routes (no auth)
app.use('/api/v1/fuel-types', require('./routes/v1/fuelTypeRoutes'));

// Admin fuel type routes (protected)
app.use('/api/v1/admin/fuel-types', require('./routes/v1/admin/fuelTypeRoutes'));

// Public transmissions
app.use('/api/v1/transmissions', require('./routes/v1/transmissionRoutes'));

// Admin transmissions (protected)
app.use('/api/v1/admin/transmissions', require('./routes/v1/admin/transmissionRoutes'));
// Public models – no token
app.use('/api/v1/models', require('./routes/v1/modelRoutes'));
// Public car types
app.use('/api/v1/car-types', require('./routes/v1/carTypeRoutes'));

// Admin car types
app.use('/api/v1/admin/car-types', require('./routes/v1/admin/carTypeRoutes'));

// Admin models – protected
app.use('/api/v1/admin/models', require('./routes/v1/admin/modelRoutes'));
// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});
// Global error handler
app.use(globalErrorHandler);

module.exports = app;