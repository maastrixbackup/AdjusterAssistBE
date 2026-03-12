const Subscription = require("../models/subscription.model");

const getMySubscription = async (req, res) => {
    try {
        const stats = await Subscription.getStats(req.user.id);
        
        // If no stats found (uninitialized user), the frontend should still get a valid object
        const subData = stats || { plan_type: 'free', usage_limit: 5, current_usage: 0 };

        res.status(200).json({ 
            success: true, 
            subscription: {
                ...subData,
                remaining: Math.max(0, subData.usage_limit - subData.current_usage)
            } 
        });
    } catch (error) {
        console.error("Fetch Sub Error:", error);
        res.status(500).json({ success: false, message: "Error fetching subscription" });
    }
};

const upgradeSubscription = async (req, res) => {
    try {
        const { planType } = req.body; 
        const userId = req.user.id;

        const planConfigs = {
            pro: { limit: 500, days: 30 },
            enterprise: { limit: 999999, days: 90 } 
        };

        const config = planConfigs[planType];
        if (!config) {
            return res.status(400).json({ success: false, message: "Invalid plan type" });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + config.days);

        await Subscription.updateTier(userId, {
            plan_type: planType,
            usage_limit: config.limit,
            expires_at: expiryDate
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully upgraded to ${planType.toUpperCase()}! Your new limit is ${config.limit === 999999 ? 'unlimited' : config.limit} drafts.` 
        });
    } catch (error) {
        console.error("Upgrade Error:", error);
        res.status(500).json({ success: false, message: "Upgrade error" });
    }
};

module.exports = { getMySubscription, upgradeSubscription };