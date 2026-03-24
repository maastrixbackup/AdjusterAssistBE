const Subscription = require("../models/subscription.model");
const { sendSubscriptionUpgradeEmail } = require("../services/email.service");

/**
 * Fetches the current user's subscription status
 */
const getMySubscription = async (req, res) => {
    try {
        // req.user.id comes from your Auth Middleware
        const stats = await Subscription.getStats(req.user.id);
        
        // If the user somehow isn't initialized yet, we trigger the repair logic
        if (!stats) {
            await Subscription.initFreeTier(req.user.id);
            const newStats = await Subscription.getStats(req.user.id);
            
            return res.status(200).json({
                success: true,
                subscription: {
                    ...newStats,
                    remaining: newStats.usage_limit - newStats.current_usage
                }
            });
        }

        res.status(200).json({ 
            success: true, 
            subscription: {
                ...stats,
                // Calculate remaining drafts for the React Native UI
                remaining: Math.max(0, stats.usage_limit - stats.current_usage)
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
        const userId = req.user.id;

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

        // Update the tier in Supabase
        await Subscription.updateTier(userId, {
            plan_type: planType.toLowerCase(),
            usage_limit: config.limit,
            expires_at: expiryDate.toISOString() // PostgreSQL preference
        });

        // Async email notification
        sendSubscriptionUpgradeEmail(req.user.email, planType).catch(err => {
            console.error("Upgrade Email Failed:", err.message);
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully upgraded to ${planType.toUpperCase()}!`,
            newLimit: config.limit === 999999 ? 'unlimited' : config.limit
        });
    } catch (error) {
        console.error("Upgrade Process Error:", error.message);
        res.status(500).json({ success: false, message: "Could not complete the upgrade" });
    }
};

module.exports = { getMySubscription, upgradeSubscription };