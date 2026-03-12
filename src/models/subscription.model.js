const db = require("../config/db");

const Subscription = {
  findByUserId: async (userId) => {
    const [rows] = await db.execute("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
    return rows[0];
  },

  incrementUsage: async (userId) => {
    return await db.execute(
      "UPDATE subscriptions SET current_usage = current_usage + 1 WHERE user_id = ?",
      [userId]
    );
  }
};

module.exports = Subscription;