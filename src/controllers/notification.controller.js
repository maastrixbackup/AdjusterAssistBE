const { supabaseAdmin } = require('../config/supabase');
const { sendPushNotificationToUser, sendPushNotificationToMultipleUsers } = require('../services/pushNotification.service');

exports.saveToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pushToken } = req.body;

    if (!userId || !pushToken) {
      return res.status(400).json({ error: "UserId and Token are required" });
    }
    await supabaseAdmin
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('expo_push_token', pushToken)
      .neq('id', userId); 

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ expo_push_token: pushToken })
      .eq('id', userId);

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      message: "Push token saved" 
    });
  } catch (error) {
    console.error("Backend Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get user with token from Supabase
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch user token' });
    }

    if (!data || !data.expo_push_token) {
      return res
        .status(400)
        .json({ error: 'No push token saved for this user' });
    }

    const pushToken = data.expo_push_token;

    // 2. Call push service
    const tickets = await sendPushNotificationToUser(
      pushToken,
      'Hello from backend 👋', // title
      'This is a test notification from your Node server', // body
      { test: true } // optional data
    );

    return res.status(200).json({
      success: true,
      message: 'Notification sent (or queued) successfully',
      tickets,
    });
  } catch (err) {
    console.error('sendTestNotification error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.sendBroadcastNotification = async (req, res) => {
  try {
    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    // 1. Get ALL users who have a push token
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token')
      .not('expo_push_token', 'is', null);

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch tokens' });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found with push tokens' });
    }

    // 2. Extract tokens into a simple array
    const tokens = users.map(u => u.expo_push_token);

    // 3. Call the updated service (see step 2 below)
    const tickets = await sendPushNotificationToMultipleUsers(
      tokens,
      title,
      body,
      data || {}
    );

    return res.status(200).json({
      success: true,
      count: tokens.length,
      message: `Broadcast initiated for ${tokens.length} users`,
      tickets,
    });
  } catch (err) {
    console.error('Broadcast error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};