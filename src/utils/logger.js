// src/utils/logger.js

// Import Winston logging library
// Winston is used to record application logs
// (info, warnings, errors, debug messages, etc.)
const winston = require('winston');

// Create a logger instance
const logger = winston.createLogger({

  // Minimum log level to display/store
  // info = show info, warn, and error logs
  level: 'info',

  // Define where logs should be written
  transports: [

    // Output logs to terminal/console
    // Useful during development
    new winston.transports.Console()

  ]
});

// Export logger so it can be used anywhere
// Example:
// logger.info("Server started");
// logger.error("Database connection failed");
module.exports = logger;