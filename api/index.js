// api/index.js
const app = require('../src/app');

module.exports = (req, res) => {
  try {
    app(req, res);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    res.status(500).json({
      success: false,
      error: 'Vercel Serverless Function Failed to Start',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};