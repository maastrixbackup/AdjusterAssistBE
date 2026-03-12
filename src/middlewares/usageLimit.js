const Subscription = require("../models/subscription.model");

const checkUsageLimit = async (req, res, next) => {
  try {
    const userId = req.user.id; 
    const sub = await Subscription.findByUserId(userId);

    if (!sub) {
      return res.status(403).json({ message: "No active subscription found." });
    }

    if (sub.current_usage >= sub.usage_limit) {
      return res.status(403).json({ 
        message: "Monthly limit reached. Please upgrade your plan." 
      });
    }
    next(); 
  } catch (error) {
    res.status(500).json({ message: "Error checking usage limits" });
  }
};

module.exports = checkUsageLimit;