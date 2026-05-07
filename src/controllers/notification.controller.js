const supabase = require('../config/supabase'); 
const { sendPushNotificationToUser } = require('../services/pushNotification.service');

exports.saveToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pushToken } = req.body;

    if (!userId || !pushToken) {
      return res.status(400).json({ error: "UserId and Token are required" });
    }

    // Update the 'users' table column 'expo_push_token'
    const { data, error } = await supabase
      .from('users')
      .update({ expo_push_token: pushToken })
      .eq('id', userId);

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      message: "Push token saved to AdjusterAssist database" 
    });
  } catch (error) {
    console.error("Backend Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get user with token from Supabase
    const { data, error } = await supabase
      .from('users')
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