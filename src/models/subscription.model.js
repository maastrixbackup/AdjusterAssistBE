const db = require("../config/db");

const Subscription = {
    // 1. Unified Stats Fetcher (Always returns an object to prevent crashes)
    async getStats(userId) {
        const [rows] = await db.query(
            "SELECT plan_type, usage_limit, current_usage, expires_at FROM subscriptions WHERE user_id = ?",
            [userId]
        );
        // If no row exists, return null so the reset logic knows to create one
        return rows[0] || null;
    },

    // 2. Increments usage during draft generation
    async incrementUsage(userId) {
        return await db.query(
            "UPDATE subscriptions SET current_usage = current_usage + 1 WHERE user_id = ?",
            [userId]
        );
    },

    // 3. Upgrade logic for Gold/Diamond plans
    async updateTier(userId, planData) {
        const { plan_type, usage_limit, expires_at } = planData;
        return await db.query(
            `UPDATE subscriptions 
             SET plan_type = ?, usage_limit = ?, current_usage = 0, expires_at = ?, status = 'active' 
             WHERE user_id = ?`,
            [plan_type, usage_limit, expires_at, userId]
        );
    },

    // 4. Initialization for new users
    async initFreeTier(userId) {
        const initialExpiry = new Date();
        initialExpiry.setDate(initialExpiry.getDate() + 30); 

        return await db.query(
            "INSERT INTO subscriptions (user_id, plan_type, usage_limit, current_usage, expires_at, status) VALUES (?, 'free', 5, 0, ?, 'active')",
            [userId, initialExpiry]
        );
    },

    // 5. CRITICAL FIX: The Monthly Reset & Auto-Repair Logic
  async checkAndResetMonthlyUsage(userId) {
    try {
        let sub = await this.getStats(userId);

        if (!sub) {
            await this.initFreeTier(userId);
            return;
        }

        const now = new Date();
        const expiry = new Date(sub.expires_at);

        if (now > expiry) {
            const nextExpiry = new Date();
            // Move forward exactly one month
            nextExpiry.setMonth(nextExpiry.getMonth() + 1);

            // This single query handles both:
            // 1. Refreshing a Free user for a new month
            // 2. Downgrading a Pro/Enterprise user whose time is up
            await db.query(
                `UPDATE subscriptions 
                 SET plan_type = 'free', 
                     usage_limit = 5, 
                     current_usage = 0, 
                     expires_at = ?, 
                     status = 'active' 
                 WHERE user_id = ?`,
                [nextExpiry, userId]
            );
            
            const action = sub.plan_type === 'free' ? "Refreshed" : "Downgraded";
            console.log(`${action} user ${userId} to Free Tier for the new month.`);
        }
    } catch (error) {
        console.error("Error in checkAndResetMonthlyUsage:", error);
    }
}
};

module.exports = Subscription;