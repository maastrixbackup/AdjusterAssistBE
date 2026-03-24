const User = require("../models/user"); 
const Subscription = require("../models/subscription.model");

/**
 * Retrieves the logged-in user's detailed profile and subscription
 */
const getProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token payload missing user ID",
            });
        }

        const userId = req.user.id;
        
        // FIX: Use findById because 'userId' is a numeric ID, not an email
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const subscription = await Subscription.getStats(userId);
        
        const subData = subscription || { 
            plan_type: 'free', 
            usage_limit: 5, 
            current_usage: 0, 
            expires_at: null 
        };

        const { password, ...safeUser } = user;

        res.status(200).json({ 
            success: true, 
            user: {
                ...safeUser,
                subscription: {
                    plan: subData.plan_type,
                    limit: subData.usage_limit,
                    used: subData.current_usage,
                    remaining: Math.max(0, subData.usage_limit - subData.current_usage),
                    expires_at: subData.expires_at
                }
            }
        });
    } catch (error) {
        console.error("Profile Error:", error.message);
        res.status(500).json({ success: false, message: "Server error fetching profile" });
    }
};

/**
 * Retrieves all users with their plan statuses
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();

        const usersWithStats = await Promise.all(users.map(async (user) => {
            const sub = await Subscription.getStats(user.id);
            const subData = sub || { plan_type: 'free', current_usage: 0, usage_limit: 5 };
            const { password, ...userData } = user;

            return {
                ...userData,
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
        console.error("Get All Users Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch users from database"
        });
    }
};

module.exports = { getProfile, getAllUsers };