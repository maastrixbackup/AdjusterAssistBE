const supabase = require('../config/supabase'); 

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