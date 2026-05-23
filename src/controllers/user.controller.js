const Profile = require("../models/profile");
const Subscription = require("../models/subscription.model");
const { uploadAvatar } = require("../services/profileStorageService");

/**
 * Retrieves the logged-in user's detailed profile and subscription
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Profile.findById(req.supabase, userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const subscription = await Subscription.getStats(userId);

    const subData = subscription || {
      plan_type: "free",
      usage_limit: 5,
      current_usage: 0,
      expires_at: null,
    };

    res.status(200).json({
      success: true,
      user: {
        ...user,
        subscription: {
          plan: subData.plan_type,
          limit: subData.usage_limit,
          used: subData.current_usage,
          remaining: Math.max(0, subData.usage_limit - subData.current_usage),
          expires_at: subData.expires_at,
        },
      },
    });
  } catch (error) {
    console.error("Profile Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

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

    if (req.file) {
      const uploadedAvatar = await uploadAvatar(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
      );

      avatar_url =
        typeof uploadedAvatar === "string"
          ? uploadedAvatar
          : uploadedAvatar.publicUrl;
    }

    const updateFields = {};

    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (company !== undefined) updateFields.company = company;
    if (expo_push_token !== undefined) {
      updateFields.expo_push_token = expo_push_token;
    }
    if (push_enabled !== undefined) {
      updateFields.push_enabled = push_enabled;
    }
    if (avatar_url !== undefined) {
      updateFields.avatar_url = avatar_url;
    }
    if (is_signature_enabled !== undefined) {
      updateFields.is_signature_enabled = is_signature_enabled;
    }
    if (signature_details !== undefined) {
      updateFields.signature_details =
        typeof signature_details === "string"
          ? JSON.parse(signature_details)
          : signature_details;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

    const updatedUser = await Profile.updateProfile(
      req.supabase,
      userId,
      updateFields,
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
      avatar_url,
    });
  } catch (error) {
    console.error("Update Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

module.exports = { getProfile, updateProfile };
