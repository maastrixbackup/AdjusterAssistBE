const {
    supabaseAdmin,
    supabase,
    createUserClient,
} = require("../config/supabase");
const Subscription = require("../models/subscription.model");
const { sendLoginEmail } = require("../services/email.service");

const refreshSession = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                message: "Refresh token required",
            });
        }

        // IMPORTANT
        // Use NON-admin Supabase client
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token,
        });

        if (error || !data.session) {
            return res.status(401).json({
                success: false,
                code: "INVALID_REFRESH_TOKEN",
                message: "Session expired. Please login again.",
            });
        }

        const session = data.session;
        const user = data.user;

        return res.status(200).json({
            success: true,

            access_token: session.access_token,
            refresh_token: session.refresh_token,

            expires_at: session.expires_at,

            aal: session.user?.aal || "aal1",

            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || "",
            },
        });

    } catch (error) {

        console.error("Refresh Session Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to refresh session",
        });
    }
};

/**
 * Handles User Login via Supabase Auth
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Credentials missing",
            });
        }
        const normalizedEmail = email.trim().toLowerCase();
        // STEP 1
        // PASSWORD LOGIN
        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        });

        if (error) {
            if (error.message?.toLowerCase().includes("email not confirmed")) {
                return res.status(403).json({
                    success: false,
                    code: "EMAIL_NOT_VERIFIED",
                    message: "Please verify your email before logging in.",
                });
            }

            return res.status(401).json({
                success: false,
                message: "Invalid login credentials",
            });
        }

        const user = data.user;
        const session = data.session;
        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Failed to create session.",
            });
        }

        // STEP 2
        // CREATE USER CLIENT USING AAL1 TOKEN
        const userClient = await createUserClient(
            session.access_token,
            session.refresh_token,
        );

        // STEP 3
        // CHECK MFA FACTORS
        const { data: factorData, error: factorError } =
            await userClient.auth.mfa.listFactors();

        if (factorError) {
            return res.status(400).json({
                success: false,
                message: factorError.message,
            });
        }

        const verifiedFactors = factorData.totp.filter(
            (factor) => factor.status === "verified",
        );

        // STEP 4
        // MFA REQUIRED FLOW
        if (verifiedFactors.length > 0) {
            return res.status(200).json({
                success: true,
                requires_mfa: true,
                temp_access_token: session.access_token,
                temp_refresh_token: session.refresh_token,
                factor_id: verifiedFactors[0].id,
                message: "MFA verification required.",
            });
        }

        // STEP 5
        // NORMAL NON-MFA LOGIN
        let sub = await Subscription.getStats(user.id);
        if (!sub) {
            await Subscription.initFreeTier(user.id);
            sub = await Subscription.getStats(user.id);
        }

        sendLoginEmail(user.email).catch((err) =>
            console.error("Email Notification Error:", err),
        );

        return res.status(200).json({
            success: true,
            requires_mfa: false,
            requires_mfa_setup: true,
            temp_access_token: session.access_token,
            temp_refresh_token: session.refresh_token,
            message: "MFA setup required before accessing the app.",

            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || "",
            },
        });
    } catch (error) {
        console.error("Login Failure:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const { error } = await supabase.auth.resend({
            type: "signup",
            email,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Verification email resent.",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server error",
        });
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

        const normalizedEmail = email.trim().toLowerCase();
        // Password validation
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long.",
            });
        }

        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
                emailRedirectTo: "adjusterassist://callback",

                data: {
                    full_name: name,
                    role,
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
        // Existing user detection
        if (
            data?.user &&
            (!data.user.identities || data.user.identities.length === 0)
        ) {
            return res.status(409).json({
                success: false,
                code: "EMAIL_ALREADY_EXISTS",
                message: "An account with this email already exists.",
            });
        }

        return res.status(201).json({
            success: true,
            message: "Account created. Please verify your email before logging in.",
            mfa_enabled: false,
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

const verifyCallback = async (req, res) => {
    try {
        const { access_token, refresh_token } = req.body;

        // 1. Validate payload requirements
        if (!access_token) {
            return res.status(400).json({
                success: false,
                message: "Security verification parameters missing.",
            });
        }

        const {
            data: { user },
            error,
        } = await supabaseAdmin.auth.getUser(access_token);

        if (error || !user) {
            console.error("Supabase verification failed:", error?.message);
            return res.status(401).json({
                success: false,
                message: "The link is invalid, expired, or has already been used.",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Security tunnel established and email verified successfully.",
            session: {
                token: access_token,
                email: user.email,
                userId: user.id,
            },
        });
    } catch (error) {
        console.error("Critical Failure in verifyCallback controller:", error);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred during backend verification.",
        });
    }
};

/**
 * Initiates Password Reset
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res
                .status(400)
                .json({ success: false, message: "Email is required." });
        }

        // Check user exists using the admin client
        const { data: users, error: userError } =
            await supabaseAdmin.auth.admin.listUsers();
        if (userError) {
            return res
                .status(500)
                .json({ success: false, message: "Unable to verify account." });
        }

        const existingUser = users?.users?.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (!existingUser) {
            return res
                .status(404)
                .json({ success: false, message: "No account found with this email." });
        }

        // 💡 By NOT passing a "redirectTo" option, Supabase defaults to sending a 6-digit alphanumeric token code
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
            email.trim().toLowerCase(),
        );

        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }

        return res.status(200).json({
            success: true,
            message: "A 6-digit secure recovery code has been sent to your email.",
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

/**
 * STEP 2: Verify the 6-digit OTP Token Code
 * Receives the code from the mobile app, validates it with Supabase, and returns an access token
 */
const verifyOTP = async (req, res) => {
    try {
        const { email, token } = req.body; // 'token' is the 6-digit code entered by the user

        if (!email || !token) {
            return res.status(400).json({
                success: false,
                message: "Both email and the 6-digit OTP code are required.",
            });
        }

        // Exchange the 6-digit code for a real access token session
        const { data, error } = await supabaseAdmin.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: token.trim(),
            type: "recovery", // Explicitly targets password recovery OTP instances
        });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message || "Invalid or expired recovery code.",
            });
        }

        // Return the authenticated session token back to the Expo frontend
        return res.status(200).json({
            success: true,
            message: "Code verified successfully.",
            accessToken: data.session.access_token, // 🌟 Send this back to the app to authorize Step 3
        });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Server verification error." });
    }
};

/**
 * STEP 3: Complete Password Update
 * Uses the validated token context to overwrite the user's credentials securely
 */
const resetPassword = async (req, res) => {
    try {
        const { newPassword, accessToken } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long.",
            });
        }

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Missing secure token authorization session context.",
            });
        }

        // Authenticate the verified token to extract the target user profile safely
        const {
            data: { user },
            error: jwtError,
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (jwtError || !user) {
            return res.status(401).json({
                success: false,
                message:
                    "Your reset session has expired. Please verify your OTP again.",
            });
        }

        // Update credentials administratively via verified internal User ID
        const { error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password: newPassword,
            });

        if (updateError) {
            return res
                .status(400)
                .json({ success: false, message: updateError.message });
        }

        return res.status(200).json({
            success: true,
            message: "Password updated successfully.",
        });
    } catch (error) {
        console.error("Reset Password Error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Server error saving password." });
    }
};

const logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const access_token = authHeader.split(" ")[1];
        // Create USER scoped client
        const client = await createUserClient(access_token);
        // Revoke current session
        const { error } = await client.auth.signOut();
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });
    } catch (error) {
        console.error(
            "Logout Error:",
            error
        );
        return res.status(500).json({
            success: false,
            message: "Logout failed",
        });
    }
};

module.exports = {
    login,
    signup,
    forgotPassword,
    resetPassword,
    logout,
    resendVerification,
    verifyCallback,
    refreshSession
};
