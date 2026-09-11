const Queue = require('bull');
const { matchRequirementsForCar } = require('../services/requirementMatchingService');

// Create the queue
const notificationQueue = new Queue('car-matching', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  }
});

// Process the jobs
notificationQueue.process(async (job) => {
  const { carId } = job.data;
  if (!carId) {
    throw new Error('carId is required in job data');
  }

  console.log(`[Notification Queue] Processing car matching for carId: ${carId}`);
  await matchRequirementsForCar(carId);
  console.log(`[Notification Queue] Finished processing for carId: ${carId}`);
});

notificationQueue.on('error', (error) => {
  console.error('[Notification Queue] Error:', error);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`[Notification Queue] Job failed for carId ${job.data.carId}:`, err);
});

module.exports = notificationQueue;
