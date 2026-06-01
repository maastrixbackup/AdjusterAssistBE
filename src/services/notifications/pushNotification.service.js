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

const dispatchNotificationToSelectedUsers = async ({ userIds, type, title, body, metadata = {} }) => {
    try {
        if (!userIds || userIds.length === 0) return;

        // 1. Prepare bulk rows for the notifications table
        const recordsToInsert = userIds.map(userId => ({
            user_id: userId,
            type: type.toUpperCase(),
            title,
            body,
            metadata
        }));

        // 2. Insert ALL records into the DB inbox in ONE single query 🚀
        const { data: insertedRows, error: dbError } = await supabaseAdmin
            .from('notifications')
            .insert(recordsToInsert)
            .select('user_id, id');

        if (dbError) throw dbError;

        // 3. Fetch active push tokens only for these selected users
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, expo_push_token')
            .in('id', userIds)
            .not('expo_push_token', 'is', null);

        if (profileError) throw profileError;

        // 4. Send the push notifications collectively using your existing multi-user service
        if (profiles && profiles.length > 0) {
            const tokens = profiles.map(p => p.expo_push_token);
            
            // Call your service in fire-and-forget fashion
            sendPushNotificationToMultipleUsers(tokens, title, body, metadata)
                .catch(err => console.error("⚠️ Bulk push notification warning:", err.message));
        }

    } catch (error) {
        console.error("❌ Bulk Selected Notification Dispatcher Crash:", error.message);
    }
};

module.exports = { sendPushNotificationToUser, sendPushNotificationToMultipleUsers, dispatchNotificationToSelectedUsers };