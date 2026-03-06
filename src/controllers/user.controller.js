const User = require("../models/user");

const getProfile = async (req, res) => {
    try {
        console.log("Decoded User from Middleware:", req.user);

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

        // // Security best practice: remove password if it exists in the object
        // delete user.password;

        res.status(200).json({ 
            success: true, 
            user 
        });
    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();

        res.status(200).json({
            success: true,
            count: users.length,
            users: users
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