const Profile = require("../models/profile"); 
const Subscription = require("../models/subscription.model");
const { uploadAvatar } = require("../services/profileStorageService");

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
        const user = await Profile.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "Profile not found" });
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

const getAllProfiles = async (req, res) => {
    try {
        const users = await Profile.findAll();

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

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, 
      phone, 
      company, 
      expo_push_token, 
      is_signature_enabled, 
      signature_details,
      push_enabled,
    } = req.body;
    
    let { avatar_url } = req.body;

    // 1. Handle Image Upload
    if (req.file) {
      avatar_url = await uploadAvatar(
        req.file.buffer,
        `${userId}-${Date.now()}`,
        req.file.mimetype
      );
    }

    // 2. Construct update object
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (company !== undefined) updateFields.company = company;
    if (expo_push_token !== undefined) updateFields.expo_push_token = expo_push_token;
    if (push_enabled !== undefined) updateFields.push_enabled = push_enabled;
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;

    // --- NEW SIGNATURE FIELDS ---
    if (is_signature_enabled !== undefined) {
        updateFields.is_signature_enabled = is_signature_enabled;
    }

    // If signature_details is sent, ensure it's handled as an object
    if (signature_details !== undefined) {
        // Option A: If sending the whole object from frontend
        updateFields.signature_details = typeof signature_details === 'string' 
            ? JSON.parse(signature_details) 
            : signature_details;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    // 3. Update Database
    const updatedUser = await Profile.updateProfile(userId, updateFields);

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
      avatar_url: avatar_url 
    });
  } catch (error) {
    console.log(error)
    console.error("Update Error:", error.message);
    return res.status(500).json({ 
      error: error.message || "Internal Server Error" 
    });
  }
};

module.exports = { getProfile, updateProfile, getAllProfiles };