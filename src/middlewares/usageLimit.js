const Subscription = require("../models/subscription.model");

const checkUsageLimit = async (req, res, next) => {
  try {
    const userId = req.user.id; 
    await Subscription.checkAndResetMonthlyUsage(userId);
    let sub = await Subscription.getStats(userId);

    // 2. Fallback: If no record exists (Profile exists but no sub row)
    if (!sub) {
      await Subscription.initFreeTier(userId);
      sub = await Subscription.getStats(userId);
    }

    if (!sub) {
      return res.status(403).json({ 
        success: false, 
        message: "Unable to verify subscription status." 
      });
    }

    // 3. ENTERPRISE BYPASS: Enterprise users have no limits
    if (sub.plan_type === 'enterprise') {
        return next();
    }

    // 4. EXPIRY CHECK: Block if the plan has expired and isn't 'free'
    const now = new Date();
    if (sub.plan_type !== 'free' && new Date(sub.expires_at) < now) {
        return res.status(403).json({ 
            success: false, 
            message: "Your subscription has expired. Please renew your plan.",
            expired: true
        });
    }

    // 5. USAGE LIMIT CHECK
    if (sub.current_usage >= sub.usage_limit) {
      return res.status(403).json({ 
        success: false,
        message: "Monthly draft limit reached. Please upgrade your plan.",
        plan: sub.plan_type,
        used: sub.current_usage,
        limit: sub.usage_limit
      });
    }

    next(); 
  } catch (error) {
    console.error("Usage Limit Middleware Error:", error);
    res.status(500).json({ success: false, message: "Error checking usage limits" });
  }
};

module.exports = checkUsageLimit;