const User = require("../models/user");
const Subscription = require("../models/subscription.model"); // Import the model

const getProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token payload missing user ID",
            });
        }

        const userId = req.user.id;
        
        // 1. Get user details (this already includes 'role' from your Model.findById)
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. Get subscription/usage details using the Model method
        const subscription = await Subscription.getStats(userId);

        res.status(200).json({ 
            success: true, 
            user: {
                ...user,
                subscription: {
                    plan: subscription.plan_type,
                    limit: subscription.usage_limit,
                    used: subscription.current_usage,
                    remaining: subscription.usage_limit - subscription.current_usage
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
        // 1. Fetch all users (already includes roles)
        const users = await User.findAll();

        // 2. Map through users to attach their subscription status
        // Note: In a large production app, you might use a SQL JOIN instead 
        // for better performance, but this is clean for now.
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const sub = await Subscription.getStats(user.id);
            return {
                ...user,
                subscription: {
                    plan: sub.plan_type,
                    used: sub.current_usage,
                    limit: sub.usage_limit
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