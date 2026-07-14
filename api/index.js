// api/index.js
let app;

try {
  app = require('../src/app');
  console.log('✅ App loaded successfully');
} catch (error) {
  console.error('❌ Failed to load app:', error);
  // Export a function that returns the error as JSON
  module.exports = (req, res) => {
    res.status(500).json({
      success: false,
      error: 'App failed to load',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  };
  return;
}

// If app loaded successfully, export the handler
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