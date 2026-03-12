const Subscription = require("../models/subscription.model");

const checkUsageLimit = async (req, res, next) => {
  try {
    const userId = req.user.id; 
    
    // 1. Use getStats to stay consistent with your Model method names
    let sub = await Subscription.getStats(userId);

    // 2. Fallback: If no record exists, try to initialize it
    if (!sub) {
      await Subscription.initFreeTier(userId);
      sub = await Subscription.getStats(userId);
    }

    // 3. Final safety check
    if (!sub) {
      return res.status(403).json({ 
        success: false, 
        message: "Unable to verify subscription status." 
      });
    }

    // 4. Check if they have reached their limit
    if (sub.current_usage >= sub.usage_limit) {
      return res.status(403).json({ 
        success: false,
        message: "Monthly draft limit reached.",
        plan: sub.plan_type,
        used: sub.current_usage,
        limit: sub.usage_limit
      });
    }

    // If limit not reached, proceed to create the draft
    next(); 
  } catch (error) {
    console.error("Usage Limit Middleware Error:", error);
    res.status(500).json({ success: false, message: "Error checking usage limits" });
  }
};

module.exports = checkUsageLimit;