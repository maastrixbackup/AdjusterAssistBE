const { supabaseAdmin } = require("../config/supabase");
const { dispatchNotification } = require("../services/notifications/notificationDispatcher");

const Subscription = {
  // 1. Unified Stats Fetcher
  async getStats(userId) {
    const { data, error } = await supabaseAdmin
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
  async incrementUsage(userId) {
    const { error } = await supabaseAdmin.rpc("increment_subscription_usage", {
      target_user_id: userId,
    });

    if (error) {
      console.error("RPC Increment Error:", error.message);
      throw error;
    }
    return true;
  },

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

    await dispatchNotification({
      userId: userId,
      type: 'SUBSCRIPTION_UPDATE',
      title: 'Plan Activated Successfully! 💎',
      body: `Welcome to the ${plan_type.toUpperCase()} plan. Your new limit is ${usage_limit} drafts.`,
      metadata: { plan_type, usage_limit }
    });

    return data;
  },

  // 4. Initialization for new users
  async initFreeTier(userId) {
    if (!userId) {
      throw new Error("userId is required");
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_type: "free",
          usage_limit: 10,
          current_usage: 0,
          expires_at: expiresAt.toISOString(),
          status: "active",
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Subscription Init Error:", error);
      throw error;
    }

    await dispatchNotification({
      userId: userId,
      type: 'SUBSCRIPTION_UPDATE',
      title: 'Welcome to AdjusterAssist! 🎉',
      body: 'Your free tier has been activated with 10 complimentary draft credits.',
      metadata: { plan_type: "free", usage_limit: 10 }
    });

    return data;
  },

  // 5. Monthly Reset & Auto-Repair Logic
  async checkAndResetMonthlyUsage(userId) {
    try {
      let sub = await this.getStats(userId);

      if (!sub) {
        console.log(`🔧 Initializing missing subscription for user: ${userId}`);
        await this.initFreeTier(userId);
        return;
      }

      const now = new Date();
      const expiry = new Date(sub.expires_at);

      if (now > expiry) {
        const nextExpiry = new Date();
        nextExpiry.setMonth(nextExpiry.getMonth() + 1);

        const limit = sub.usage_limit || 10;

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            current_usage: 0, 
            expires_at: nextExpiry.toISOString(),
            status: "active",
          })
          .eq("user_id", userId);

        if (error) throw error;
        console.log(`🚀 Usage Refreshed for user ${userId}. Plan: ${sub.plan_type}`);
        
        await dispatchNotification({
          userId: userId,
          type: 'SUBSCRIPTION_UPDATE',
          title: 'Monthly Usage Renewed! 🚀',
          body: `Your usage metrics have successfully rolled over. You have ${limit} drafts available this month.`,
          metadata: { current_limit: limit }
        });
      }
    } catch (error) {
      console.error("Error in checkAndResetMonthlyUsage:", error.message);
    }
  }
}

module.exports = Subscription;