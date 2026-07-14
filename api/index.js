// api/index.js
let app;

try {
  app = require('../src/app');
  console.log('✅ App loaded successfully');
} catch (error) {
  console.error('❌ Failed to load app:', error);
  // Export a fallback handler that returns a JSON error
  module.exports = (req, res) => {
    res.status(500).json({
      success: false,
      error: 'App failed to load',
      message: error ? error.message : 'Unknown error',
    });
  };
  return;
}

// If app loaded successfully, export the request handler
module.exports = (req, res) => {
  try {
    app(req, res);
  } catch (error) {
    console.error('💥 Request handler error:', error);
    res.status(500).json({
      success: false,
      error: 'Request failed',
      message: error.message,
    });
  }
};