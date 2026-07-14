module.exports = (req, res) => {
  try {
    // Import app lazily inside the handler so that any module initialization error
    // is caught here, logged to the console, and returned as a JSON error response.
    const app = require('../src/app');
    app(req, res);
  } catch (error) {
    console.error('💥 FATAL Serverless Function Crash:', error);
    res.status(500).json({
      success: false,
      error: 'Vercel Serverless Function Failed to Start',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};