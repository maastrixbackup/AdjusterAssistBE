const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/jwt");
const User = require("../models/user");
const { sendResetEmail, sendSignupEmail, sendLoginEmail } = require("../services/email.service");
const crypto = require("crypto");
const Subscription = require("../models/subscription.model");


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found. Please sign up first." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }

        // 1. Fetch subscription details
        const subscription = await Subscription.getStats(user.id);

        // 2. Generate token with a clean payload
        const token = generateToken({ id: user.id, email: user.email });

        await sendLoginEmail(user.email);

        // 3. Build response
        res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                subscription: {
                    plan: subscription.plan_type,
                    limit: subscription.usage_limit,
                    used: subscription.current_usage,
                    remaining: subscription.usage_limit - subscription.current_usage
                }
            },
            token: token,
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: "Server error during login" });
    }
};

const signup = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const validRoles = ['ca', 'pa'];
        if (!validRoles.includes(role.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Invalid role. Use 'ca' or 'pa'." });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword, role: role.toLowerCase() });

        // Auto-initialize free tier
        await Subscription.initFreeTier(newUser.id);
        const subscription = await Subscription.getStats(newUser.id);

        const token = generateToken({ id: newUser.id, email: newUser.email });

        sendSignupEmail(newUser.email, newUser.name).catch(console.error);

        return res.status(201).json({
            success: true,
            message: `User created successfully for ${role.toUpperCase()} workspace`,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                subscription: {
                    plan: subscription.plan_type,
                    limit: subscription.usage_limit,
                    used: subscription.current_usage,
                    remaining: subscription.usage_limit - subscription.current_usage
                }
            },
            token: token
        });
    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(500).json({ success: false, message: "Server error during registration" });
    }
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const token = crypto.randomBytes(20).toString("hex");
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await User.setResetToken(user.id, token, expires);
        console.log(token)

        const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const resetLink = `${baseUrl}/reset-password?token=${token}`;

        await sendResetEmail(user.email, resetLink);

        res.status(200).json({
            success: true,
            message: "Reset link sent to email"
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ success: false, message: "Error sending email" });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const user = await User.findByResetToken(token);
        if (!user) {
            return res.status(400).json({ success: false, message: "Token is invalid or expired" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updatePassword(user.id, hashedPassword);

        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error resetting password" });
    }
};

const logout = async (req, res) => {
    // Since we're using JWTs, logout can be handled on the client side by simply deleting the token.
    res.status(200).json({ success: true, message: "Logout successful" });
};

module.exports = { login, signup, forgotPassword, resetPassword, logout };