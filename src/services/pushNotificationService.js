const { getMessaging } = require('firebase-admin/messaging');
const { getApps } = require('firebase-admin/app');
const adminApp = require('../config/firebase');
const { User } = require('../models');

exports.sendPushToUser = async (userId, title, body, data = {}) => {
  if (!getApps().length) {
    return { success: false, reason: 'firebase_not_initialized' };
  }

  try {
    const user = await User.findByPk(userId);
    if (!user || !user.device_token) {
      console.warn(`[Push Service] No device token for user ${userId}`);
      return { success: false, reason: 'no_device_token' };
    }

    // Convert data values to strings
    const stringData = {};
    for (const key in data) {
      if (data[key] !== null && data[key] !== undefined) {
        stringData[key] = String(data[key]);
      }
    }

    const message = {
      token: user.device_token,
      notification: {
        title,
        body
      },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'requirement_match'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const messageId = await getMessaging(adminApp).send(message);
    console.log(`[Push Service] Successfully sent message ${messageId} to user ${userId}`);
    return { success: true, messageId };

  } catch (error) {
    console.error('[Push Service] Error sending push notification:', error);
    
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log(`[Push Service] Invalid token for user ${userId}, clearing token...`);
      await User.update(
        { device_token: null, device_type: null },
        { where: { id: userId } }
      );
    }

    return { success: false, error: error.message };
  }
};
