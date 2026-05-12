const { supabaseAdmin, supabase } = require("../config/supabase");
const Subscription = require("../models/subscription.model");
const { sendLoginEmail } = require("../services/email.service");

/**
 * Handles User Login via Supabase Auth
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Credentials missing" });
        }

        // 1. Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ success: false, message: error.message });
        }

        const user = data.user;
        const token = data.session.access_token;

        // 2. Verified User Logic: Ensure Subscription exists
        // Since profile is created only after verification, we check/init sub here
        let sub = await Subscription.getStats(user.id);

        if (!sub) {
            // This is likely their first login after verification
            console.log(`🚀 First login for ${user.email}. Initializing subscription...`);
            await Subscription.initFreeTier(user.id);
            sub = await Subscription.getStats(user.id);
        }

        // 3. Optional: Send login notification
        sendLoginEmail(user.email).catch(err => console.error("Email Error:", err));

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || "",
                subscription: {
                    plan: sub?.plan_type || "free",
                    used: sub?.current_usage || 0,
                    limit: sub?.usage_limit || 0,
                    remaining: (sub?.usage_limit || 0) - (sub?.current_usage || 0)
                }
            }
        });
    } catch (error) {
        console.error("Login Failure:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Handles User Registration via Supabase Auth
 */
const signup = async (req, res) => {
    try {
        const { name, email, password, role, acceptedPolicy } = req.body;

        if (!name || !email || !password || !role || !acceptedPolicy) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        // Create auth user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: role,
                    accepted_policies: acceptedPolicy,
                },
            },
        });

        if (error) {
            console.error("Signup Error:", error);

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(201).json({
            success: true,
            message:
                "Account created. Please check your email to verify your account.",
            user: {
                id: data.user.id,
                email: data.user.email,
            },
        });
    } catch (error) {
        console.error("Signup Failure:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create account",
        });
    }
};

/**
 * Initiates Password Reset
 */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "adjusterassist://reset-password",
        });

        if (error) return res.status(400).json({ success: false, message: error.message });

        return res.status(200).json({
            success: true,
            message: "Password reset instructions sent to your email."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Handles Password Update
 */
const resetPassword = async (req, res) => {
    const { newPassword } = req.body;
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) return res.status(400).json({ success: false, message: error.message });

        return res.status(200).json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

const logout = async (req, res) => {
    await supabase.auth.signOut();
    return res.status(200).json({ success: true });
};

module.exports = { login, signup, forgotPassword, resetPassword, logout };