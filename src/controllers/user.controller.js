const User = require("../models/user");
const Subscription = require("../models/subscription.model");

const getProfile = async (req, res) => {
    try {
        // Validation check for middleware payload
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token payload missing user ID",
            });
        }

        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 1. Get stats (our updated model now handles null cases internally)
        const subscription = await Subscription.getStats(userId);

        res.status(200).json({ 
            success: true, 
            user: {
                ...user,
                subscription: {
                    plan: subscription.plan_type,
                    limit: subscription.usage_limit,
                    used: subscription.current_usage,
                    remaining: Math.max(0, subscription.usage_limit - subscription.current_usage),
                    expires_at: subscription.expires_at
                }
            }
        });
    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();

        // 2. Map through users with a fallback check
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const sub = await Subscription.getStats(user.id);
            
            // If sub is null (uninitialized user), provide default free tier view
            const subData = sub || { plan_type: 'free', current_usage: 0, usage_limit: 5 };

            return {
                ...user,
                subscription: {
                    plan: subData.plan_type,
                    used: subData.current_usage,
                    limit: subData.usage_limit,
                    expires_at: subData.expires_at || null
                }
            };
        }));

        res.status(200).json({
            success: true,
            count: usersWithStats.length,
            users: usersWithStats
        });
    } catch (error) {
        console.error("Get All Users Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch users"
        });
    }
};

module.exports = {
    getProfile, getAllUsers
};