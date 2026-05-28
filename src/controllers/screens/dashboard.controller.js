import { logSystemEvent } from "../../models/log.js";
import Subscription from "../../models/subscription.model.js";
import Profile from "../../models/profile.js";
import File from "../../models/workspace.model.js";

export const getDashboardBootstrap = async (req, res) => {
    const userId = req.user?.id;
    try {
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access context.",
            });
        }

        // 1. Fetch files and subscription telemetry in parallel
        let [files, stats, user] = await Promise.all([
            File.findByUserId(req.supabase, userId),
            Subscription.getStats(userId),
            Profile.findById(req.supabase, userId)
        ]);

        // 2. Auto-Repair Implementation: If user has no record in 'subscriptions' table yet
        if (!stats) {
            console.log(`🔧 Auto-initializing subscription for UUID: ${userId}`);
            await Subscription.initFreeTier(userId);
            stats = await Subscription.getStats(userId);
        }

        // 3. Compute calculated metrics safely
        const usageLimit = stats?.usage_limit || 0;
        const currentUsage = stats?.current_usage || 0;
        const isEnterprise = stats?.plan_type === 'enterprise';

        const subscriptionPayload = {
            ...stats,
            remaining: isEnterprise ? 'unlimited' : Math.max(0, usageLimit - currentUsage),
            is_unlimited: isEnterprise
        };

        // 5. Send unified combined client feedback bundle
        return res.status(200).json({
            success: true,
            user: user,
            files: files || [],
            file_count: files ? files.length : 0,
            subscription: subscriptionPayload
        });

    } catch (error) {
        console.error("Dashboard Bootstrap API Error:", error);
        logSystemEvent(req, {
            userId,
            category: "dashboard",
            eventType: "DASHBOARD_API_FAILED",
            payload: { error: error, user_id: userId }
        });
        return res.status(500).json({
            success: false,
            message: "Error fetching dashboard initialization bootstrap data.",
            error: error.message
        });
    }
};