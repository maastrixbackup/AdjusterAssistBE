const { supabaseAdmin } = require("../config/supabase");

const Subscription = {
  // 1. Unified Stats Fetcher
  async getStats(userId) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_type, usage_limit, current_usage, expires_at")
      .eq("user_id", userId)
      .single();

    // PGRST116 means "No rows found", which we handle in the reset logic
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching stats:", error.message);
      throw error;
    }
    return data || null;
  },

  // 2. Increments usage during draft generation
  async incrementUsage(userId) {
    // target_user_id must match the parameter name in the SQL function above
    const { error } = await supabaseAdmin.rpc("increment_subscription_usage", {
      target_user_id: userId,
    });

    if (error) {
      console.error("RPC Increment Error:", error.message);
      throw error;
    }
    return true;
  },

  // 3. Upgrade logic for Pro/Enterprise plans
  async updateTier(userId, planData) {
    const { plan_type, usage_limit, expires_at } = planData;
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_type,
        usage_limit,
        current_usage: 0,
        expires_at: new Date(expires_at).toISOString(),
        status: "active",
      })
      .eq("user_id", userId);

    if (error) throw error;
    return data;
  },

  // 4. Initialization for new users
  async initFreeTier(userId) {
    // Set a default expiry date for the free tier (e.g., 1 month from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert([
        {
          user_id: userId,
          plan_type: 'free',
          usage_limit: 10,
          current_usage: 0,
          expires_at: expiresAt.toISOString(), // Don't leave this null
          status: 'active'
        }
      ]);

    if (error) {
      console.error("Subscription Init Error:", error);
      throw error;
    }
    return data;
  },

  // 5. Monthly Reset & Auto-Repair Logic
  async checkAndResetMonthlyUsage(userId) {
    try {
      // 1. Check if sub exists
      let sub = await this.getStats(userId);

      // 2. Initialize if missing (Auto-Repair)
      if (!sub) {
        console.log(`🔧 Initializing missing subscription for user: ${userId}`);
        await this.initFreeTier(userId);
        return;
      }

      const now = new Date();
      const expiry = new Date(sub.expires_at);

      // 3. Monthly Rollover Logic
      if (now > expiry) {
        const nextExpiry = new Date();
        nextExpiry.setMonth(nextExpiry.getMonth() + 1);

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            current_usage: 0, // Reset usage
            expires_at: nextExpiry.toISOString(),
            status: "active",
          })
          .eq("user_id", userId);

        if (error) throw error;
        console.log(`🚀 Usage Refreshed for user ${userId}. Plan: ${sub.plan_type}`);
      }
    } catch (error) {
      // We log but don't crash the app (per your middleware strategy)
      console.error("Error in checkAndResetMonthlyUsage:", error.message);
    }
  }
}

module.exports = Subscription;