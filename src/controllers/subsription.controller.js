const Subscription = require("../models/subscription.model");
const { sendSubscriptionUpgradeEmail } = require("../services/email.service");

/**
 * Fetches the current user's subscription status
 */
const getMySubscription = async (req, res) => {
    try {
        // req.user.id is a UUID string from the Supabase Auth Middleware
        const stats = await Subscription.getStats(req.user.id);
        
        // Auto-Repair: If user has no record in 'subscriptions' table yet
        if (!stats) {
            console.log(`🔧 Auto-initializing subscription for UUID: ${req.user.id}`);
            await Subscription.initFreeTier(req.user.id);
            const newStats = await Subscription.getStats(req.user.id);
            
            return res.status(200).json({
                success: true,
                subscription: {
                    ...newStats,
                    remaining: (newStats.usage_limit || 0) - (newStats.current_usage || 0),
                    is_unlimited: newStats.plan_type === 'enterprise'
                }
            });
        }

        const usageLimit = stats.usage_limit || 0;
        const currentUsage = stats.current_usage || 0;

        res.status(200).json({ 
            success: true, 
            subscription: {
                ...stats,
                // UI Helper: Calculate remaining drafts for the Mobile App
                remaining: stats.plan_type === 'enterprise' ? 'unlimited' : Math.max(0, usageLimit - currentUsage),
                is_unlimited: stats.plan_type === 'enterprise'
            } 
        });
    } catch (error) {
        console.error("Fetch Sub Error:", error.message);
        res.status(500).json({ success: false, message: "Error fetching subscription" });
    }
};

/**
 * Upgrades the user's plan and resets their usage
 */
const upgradeSubscription = async (req, res) => {
    try {
        const { planType } = req.body; 
        const userId = req.user.id; // This is a UUID string

        // Configuration mapping for Adjuster Assist tiers
        const planConfigs = {
            pro: { limit: 500, days: 30 },
            enterprise: { limit: 999999, days: 90 } 
        };

        const config = planConfigs[planType?.toLowerCase()];
        if (!config) {
            return res.status(400).json({ success: false, message: "Invalid plan type selected" });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + config.days);

        // Pass the UUID and the config to the Supabase update function
        await Subscription.updateTier(userId, {
            plan_type: planType.toLowerCase(),
            usage_limit: config.limit,
            expires_at: expiryDate.toISOString() 
        });

        // Async email notification - we don't block the response for this
        sendSubscriptionUpgradeEmail(req.user.email, planType).catch(err => {
            console.error("Upgrade Email Failed for UUID:", userId, err.message);
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully upgraded to ${planType.toUpperCase()}!`,
            newLimit: config.limit >= 999999 ? 'unlimited' : config.limit
        });
    } catch (error) {
        console.error("Upgrade Process Error:", error.message);
        res.status(500).json({ success: false, message: "Could not complete the upgrade" });
    }
};

module.exports = { getMySubscription, upgradeSubscription };