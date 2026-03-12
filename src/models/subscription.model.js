const db = require("../config/db");

const Subscription = {

  // Get subsription details 
  findByUserId: async (userId) => {
    const [rows] = await db.execute("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
    return rows[0];
  },

  // DRAFT GENERATIOn
  async incrementUsage(userId) {
    return await db.query(
      "UPDATE subscriptions SET current_usage = current_usage + 1 WHERE user_id = ?",
      [userId]
    );
  },

  // Update subscription plan (UPGRADE)
  async updateTier(userId, planData) {
    const { plan_type, usage_limit, expires_at } = planData;
    return await db.query(
      `UPDATE subscriptions 
             SET plan_type = ?, usage_limit = ?, current_usage = 0, expires_at = ?, status = 'active' 
             WHERE user_id = ?`,
      [plan_type, usage_limit, expires_at, userId]
    );
  },

  // Initializes a free tier subscription for new users (SIGNUP)
  async initFreeTier(userId) {
    return await db.query(
      "INSERT INTO subscriptions (user_id, plan_type, usage_limit, current_usage) VALUES (?, 'free', 5, 0)",
      [userId]
    );
  },

  // Used for Login response to fetch current subscription stats
  async getStats(userId) {
    const [rows] = await db.query(
      "SELECT plan_type, usage_limit, current_usage, expires_at FROM subscriptions WHERE user_id = ?",
      [userId]
    );
    return rows[0] || null;
  },

  // Reset usage if subscription expired (MONTHLY CHECK)
  async checkAndResetMonthlyUsage(userId) {
    const sub = await this.getStats(userId);
    if (!sub || !sub.expires_at) return;

    const now = new Date();
    const expiry = new Date(sub.expires_at);

    if (now > expiry) {
      // Calculate new expiry (30 days from now)
      const nextExpiry = new Date();
      nextExpiry.setDate(nextExpiry.getDate() + 30);

      await db.query(
        "UPDATE subscriptions SET current_usage = 0, expires_at = ?, status = 'active' WHERE user_id = ?",
        [nextExpiry, userId]
      );
      console.log(`Usage reset for user ${userId}`);
    }
  }

};

module.exports = Subscription;