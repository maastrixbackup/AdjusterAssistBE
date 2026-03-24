const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");
const User = require("../models/user"); 
const Subscription = require("../models/subscription.model");
const { sendResetEmail, sendSignupEmail, sendLoginEmail } = require("../services/email.service");
const crypto = require("crypto");

/**
 * Handles User Login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Credentials missing" });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, message: "Account not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // Fetch subscription directly using Supabase model logic
        const sub = await Subscription.getStats(user.id);

        const token = generateToken({ id: user.id, email: user.email });

        // Fire and forget email service
        sendLoginEmail(user.email).catch(err => console.error("Email Error:", err));

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                subscription: {
                    plan: sub.plan_type,
                    used: sub.current_usage,
                    limit: sub.usage_limit,
                    remaining: sub.usage_limit - sub.current_usage
                }
            }
        });
    } catch (error) {
        console.error("Login Failure:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Handles User Registration
 */
const signup = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 12); // Slightly higher salt for security
        
        // Create user in Supabase 'users' table
        const newUser = await User.create({ 
            name, 
            email, 
            password: hashedPassword, 
            role: role.toLowerCase() 
        });

        // Initialize Subscription logic (Ensure this uses supabase.from('subscriptions'))
        await Subscription.initFreeTier(newUser.id);
        const sub = await Subscription.getStats(newUser.id);

        const token = generateToken({ id: newUser.id, email: newUser.email });

        sendSignupEmail(newUser.email, newUser.name).catch(console.error);

        return res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                role: newUser.role,
                subscription: {
                    plan: sub.plan_type,
                    limit: sub.usage_limit
                }
            }
        });
    } catch (error) {
        console.error("Signup Failure:", error);
        return res.status(500).json({ success: false, message: "Failed to create account" });
    }
};

/**
 * Initiates Password Reset Flow
 */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findByEmail(email);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 3600000).toISOString(); // 1 Hour

        // Save to Supabase using your update method
        await User.updateResetToken(user.id, token, expires);

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        await sendResetEmail(user.email, resetLink);

        return res.status(200).json({ success: true, message: "Reset instructions sent to email" });
    } catch (error) {
        console.error("Forgot PW Error:", error);
        return res.status(500).json({ success: false, message: "Could not process request" });
    }
};

/**
 * Resets Password using Token
 */
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        // Method should find user where reset_token == token AND reset_token_expires > now
        const user = await User.findByResetToken(token);
        
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired token" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update password and clear reset fields
        await User.updatePassword(user.id, hashedPassword);

        return res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error updating password" });
    }
};

const logout = (req, res) => res.status(200).json({ success: true });

module.exports = { login, signup, forgotPassword, resetPassword, logout };