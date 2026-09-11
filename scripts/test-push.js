require('dotenv').config();
const { User } = require('../src/models');
const pushNotificationService = require('../src/services/pushNotificationService');

async function testPush() {
  try {
    // Find a user with a device token
    const user = await User.findOne({
      where: {
        device_token: {
          $not: null
        }
      }
    });

    if (!user) {
      console.log('No user found with a device token. Please login and provide a device token first.');
      process.exit(1);
    }

    console.log(`Sending test push to user ID: ${user.id}`);

    const result = await pushNotificationService.sendPushToUser(
      user.id,
      'Test Notification 🚀',
      'This is a test notification from the backend.',
      { type: 'test', timestamp: new Date().toISOString() }
    );

    console.log('Result:', result);
  } catch (error) {
    console.error('Error testing push:', error);
  } finally {
    process.exit(0);
  }
}

testPush();
