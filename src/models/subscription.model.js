const db = require("../config/db");

const Subscription = {

 // Get subsription details 
  findByUserId: async (userId) => {
    const [rows] = await db.execute("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
    return rows[0];
  },

  // DRAFT GENERATIOn
  incrementUsage: async (userId) => {
    return await db.execute(
      "UPDATE subscriptions SET current_usage = current_usage + 1 WHERE user_id = ?",
      [userId]
    );
  },


  // Initializes a free tier subscription for new users (SIGNUP)
  async initFreeTier(userId) {
        return await db.query(
            "INSERT INTO subscriptions (user_id, plan_type, usage_limit) VALUES (?, 'free', 10)",
            [userId]
        );
    },

    // Used for Login response to fetch current subscription stats
    async getStats(userId) {
        const [rows] = await db.query(
            "SELECT plan_type, usage_limit, current_usage FROM subscriptions WHERE user_id = ?", 
            [userId]
        );
        // Fallback to default if no record is found to prevent the app from crashing
        return rows[0] || { plan_type: 'free', usage_limit: 10, current_usage: 0 };
    }
};

module.exports = Subscription;