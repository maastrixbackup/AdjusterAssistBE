const supabase = require("../config/supabase");

const Subscription = {
  // 1. Unified Stats Fetcher
  async getStats(userId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan_type, usage_limit, current_usage, expires_at")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching stats:", error.message);
      throw error;
    }
    return data || null;
  },

  // 2. Increments usage during draft generation
  // Uses the RPC function we created in Step 1 for thread-safety
  async incrementUsage(userId) {
    const { error } = await supabase.rpc("increment_subscription_usage", {
      target_user_id: userId,
    });

    if (error) throw error;
    return true;
  },

  // 3. Upgrade logic for Pro/Enterprise plans
  async updateTier(userId, planData) {
    const { plan_type, usage_limit, expires_at } = planData;
    const { data, error } = await supabase
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
    const initialExpiry = new Date();
    initialExpiry.setDate(initialExpiry.getDate() + 30);

    const { data, error } = await supabase.from("subscriptions").insert([
      {
        user_id: userId,
        plan_type: "free",
        usage_limit: 5,
        current_usage: 0,
        expires_at: initialExpiry.toISOString(),
        status: "active",
      },
    ]);

    if (error) throw error;
    return data;
  },

  // 5. The Monthly Reset & Auto-Repair Logic
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
        nextExpiry.setMonth(nextExpiry.getMonth() + 1);

        const { error } = await supabase
          .from("subscriptions")
          .update({
            plan_type: "free",
            usage_limit: 5,
            current_usage: 0,
            expires_at: nextExpiry.toISOString(),
            status: "active",
          })
          .eq("user_id", userId);

        if (error) throw error;

        const action = sub.plan_type === "free" ? "Refreshed" : "Downgraded";
        console.log(`🚀 ${action} user ${userId} to Free Tier for the new month.`);
      }
    } catch (error) {
      console.error("Error in checkAndResetMonthlyUsage:", error.message);
    }
  },
};

module.exports = Subscription;