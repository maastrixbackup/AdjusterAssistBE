const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");
const User = require("../models/user"); 
const Subscription = require("../models/subscription.model");
const { sendResetEmail, sendSignupEmail, sendLoginEmail } = require("../services/email.service");
const { generateOTP } = require("../utils/otp");

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

        const sub = await Subscription.getStats(user.id);
        const token = generateToken({ id: user.id, email: user.email });

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

        const hashedPassword = await bcrypt.hash(password, 12);
        
        const newUser = await User.create({ 
            name, 
            email, 
            password: hashedPassword, 
            role: role.toLowerCase() 
        });

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
 * Initiates Password Reset (Sends OTP)
 */
/**
 * Initiates Password Reset (Sends OTP)
 */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    
    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await User.findByEmail(email);
        
        // Security Tip: Even if user isn't found, some prefer returning 200 
        // to prevent "Email Enumeration" attacks. But for internal tools, 404 is fine.
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 1. Generate 6-digit OTP
        const otp = generateOTP();
        
        // 2. Set 10-minute expiry (UTC ISO String)
        const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); 

        // 3. Update Database FIRST
        await User.updateResetToken(user.id, otp, expires);

        // 4. Send Email
        try {
            await sendResetEmail(user.email, otp); 
        } catch (emailError) {
            console.error("Mail Delivery Failed:", emailError);
            
            // OPTIONAL: Rollback the token in DB if email fails so user can retry immediately
            await User.updateResetToken(user.id, null, null);
            
            return res.status(503).json({ 
                success: false, 
                message: "Email service temporarily unavailable. Please try again later." 
            });
        }

        // 5. Success Response
        return res.status(200).json({ 
            success: true, 
            message: "A 6-digit reset code has been sent to your email" 
        });

    } catch (error) {
        // Detailed logging for your Render logs
        console.error("Forgot PW Logic Failure:", {
            error: error.message,
            email,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({ 
            success: false, 
            message: "An internal error occurred. Please contact support." 
        });
    }
};

/**
 * Verifies if the OTP is valid (Check before showing 'New Password' screen)
 */
const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findByEmail(email);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // DEBUG LOGS - Check your terminal!
        console.log("Input OTP:", otp, typeof otp);
        console.log("DB OTP:", user.reset_token, typeof user.reset_token);
        console.log("DB Expiry:", user.reset_token_expires);
        console.log("Now:", new Date().toISOString());

        const isOtpValid = String(user.reset_token).trim() === String(otp).trim();
        const isNotExpired = new Date(user.reset_token_expires) > new Date();

        if (!isOtpValid) {
            return res.status(400).json({ success: false, message: "OTP characters do not match" });
        }

        if (!isNotExpired) {
            return res.status(400).json({ success: false, message: "OTP has expired" });
        }

        return res.status(200).json({ success: true, message: "OTP Verified" });
    } catch (error) {
        console.error("Verification Error:", error);
        return res.status(500).json({ success: false, message: "Verification failed" });
    }
};
/**
 * Resets Password using OTP + Email
 */

const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        // 1. Fetch user AND the specific OTP data
        const user = await User.findByEmail(email);

        // 2. Strict validation: Must match Email, OTP, and not be expired
        const isOtpValid = String(user.reset_token) === String(otp);
        const isNotExpired = new Date(user.reset_token_expires) > new Date();

        if (!user || !isOtpValid || !isNotExpired) {
            return res.status(403).json({ 
                success: false, 
                message: "Security violation: Invalid or expired reset session." 
            });
        }

        // 3. Hash and Update
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // 4. CRITICAL: Clear the OTP fields so they can't be used AGAIN
        await User.updatePassword(user.id, hashedPassword);

        return res.status(200).json({ success: true, message: "Password updated." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

const logout = (req, res) => res.status(200).json({ success: true });

module.exports = { login, signup, forgotPassword, verifyOTP, resetPassword, logout };