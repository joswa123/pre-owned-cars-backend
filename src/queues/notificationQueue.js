const Queue = require('bull');
const { matchRequirementsForCar, matchRequirementsForCommercialVehicle } = require('../services/requirementMatchingService');

// In local dev or test, if Redis is down or has exceeded free quota, allow disabling Bull to prevent lockup
if (process.env.DISABLE_BULL_IN_DEV === 'true' || process.env.NODE_ENV === 'test') {
  module.exports = {
    add: async (data) => {
      try {
        if (data.commercialVehicleId) {
          console.log(`[Notification Queue Mock] Running matching synchronously for commercialVehicleId: ${data.commercialVehicleId}`);
          await matchRequirementsForCommercialVehicle(data.commercialVehicleId);
        } else if (data.carId) {
          console.log(`[Notification Queue Mock] Running matching synchronously for carId: ${data.carId}`);
          await matchRequirementsForCar(data.carId);
        }
      } catch (err) {
        console.warn(`[Notification Queue Mock] Synchronous matching warning: ${err.message}`);
      }
    },
    process: () => {},
    on: () => {},
  };
} else {
  // Create the queue
  const notificationQueue = new Queue('car-matching', {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      keepAlive: 30000,
      tls: process.env.REDIS_PASSWORD ? {} : undefined,
      retryStrategy: (times) => {
        if (process.env.NODE_ENV === 'test' || times > 3) {
          return null;
        }
        return Math.min(times * 50, 3000);
      }
    }
  });

  // Process the jobs
  notificationQueue.process(async (job) => {
    const { carId, commercialVehicleId } = job.data;
    if (commercialVehicleId) {
      console.log(`[Notification Queue] Processing commercial vehicle matching for commercialVehicleId: ${commercialVehicleId}`);
      await matchRequirementsForCommercialVehicle(commercialVehicleId);
      console.log(`[Notification Queue] Finished processing for commercialVehicleId: ${commercialVehicleId}`);
    } else if (carId) {
      console.log(`[Notification Queue] Processing car matching for carId: ${carId}`);
      await matchRequirementsForCar(carId);
      console.log(`[Notification Queue] Finished processing for carId: ${carId}`);
    } else {
      throw new Error('carId or commercialVehicleId is required in job data');
    }
  });

  notificationQueue.on('error', (error) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.message?.includes('max requests limit exceeded')) {
      console.warn(`[Notification Queue] Redis notice: ${error.message}`);
    } else {
      console.error('[Notification Queue] Error:', error);
    }
  });

  notificationQueue.on('failed', (job, err) => {
    console.error(`[Notification Queue] Job failed for carId ${job.data.carId}:`, err);
  });

  module.exports = notificationQueue;
}
