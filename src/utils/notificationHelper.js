const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
let expo = new Expo();

const sendPushNotification = async (targetToken, title, body, data = {}) => {
  // 1. Check if the token is a valid Expo token
  if (!Expo.isExpoPushToken(targetToken)) {
    console.error(`Push token ${targetToken} is not a valid Expo push token`);
    return;
  }

  // 2. Construct the message
  const messages = [{
    to: targetToken,
    sound: 'default',
    title: title,
    body: body,
    data: data, // You can send claim IDs or file IDs here
    priority: 'high',
  }];

  // 3. Send the notification
  try {
    let ticketChunk = await expo.sendPushNotificationsAsync(messages);
    console.log("Notification Sent successfully:", ticketChunk);
    return ticketChunk;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
};

module.exports = { sendPushNotification };