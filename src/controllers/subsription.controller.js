const Subscription = require("../models/subscription.model");

const getMySubscription = async (req, res) => {
    try {
        const stats = await Subscription.getStats(req.user.id);
        res.status(200).json({ success: true, subscription: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching subscription" });
    }
};

const upgradeSubscription = async (req, res) => {
    try {
        const { planType } = req.body; 
        const userId = req.user.id;

        const planConfigs = {
            free: { limit: 5, days: 30 }, 
            pro: { limit: 100, days: 30 },
            enterprise: { limit: 1000, days: 365 }
        };

        const config = planConfigs[planType];
        if (!config) {
            return res.status(400).json({ success: false, message: "Invalid plan type" });
        }

        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // Sets expiry to next month

        await Subscription.updateTier(userId, {
            plan_type: planType,
            usage_limit: config.limit,
            expires_at: expiryDate
        });

        res.status(200).json({ 
            success: true, 
            message: `Plan updated to ${planType}. You now have ${config.limit} drafts.` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Update failed" });
    }
};

module.exports = { getMySubscription, upgradeSubscription };