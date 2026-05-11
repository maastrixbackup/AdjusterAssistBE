// services/push.service.js
const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

async function sendPushNotificationToUser(pushToken, title, body, data = {}) {
  // Validate token
  if (!Expo.isExpoPushToken(pushToken)) {
    console.log(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [
    {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  return tickets;
}

async function sendPushNotificationToMultipleUsers(pushTokens, title, body, data = {}) {
  const messages = [];

  for (let pushToken of pushTokens) {
    // Check that all your tokens appear to be valid Expo push tokens
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    // Construct the message for each token
    messages.push({
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
    });
  }

  // The Expo SDK handles the heavy lifting of breaking 1000s of messages 
  // into small "chunks" so you don't overwhelm the Apple/Google servers.
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending chunk:', error);
    }
  }

  return tickets;
}

module.exports = { sendPushNotificationToUser, sendPushNotificationToMultipleUsers };