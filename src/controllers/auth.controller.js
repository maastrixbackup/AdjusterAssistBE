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

        const normalizedEmail = email.trim().toLowerCase();
        const { data: { users }, error: adminError } = await supabase.auth.admin.listUsers();

        if (!adminError && users) {
            const existingUser = users.find(u => u.email === normalizedEmail);

            if (existingUser && !existingUser.email_confirmed_at) {
                return res.status(403).json({
                    success: false,
                    code: "EMAIL_NOT_VERIFIED",
                    message: "Please verify your email before logging in.",
                });
            }
        }

        // 3. Authenticate with Supabase using credentials
        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        });

        if (error) {
            // Safe fallback if Supabase returns unconfirmed string explicitly
            if (error.message === "Email not confirmed") {
                return res.status(403).json({
                    success: false,
                    code: "EMAIL_NOT_VERIFIED",
                    message: "Please verify your email before logging in.",
                });
            }
            // Standard wrong password / email response
            return res.status(401).json({ success: false, message: "Invalid login credentials" });
        }

        const user = data.user;

        // 4. Subscription & Profile Initialization
        let sub = await Subscription.getStats(user.id);

        if (!sub) {
            console.log(`🚀 First login for ${user.email}. Initializing subscription...`);
            await Subscription.initFreeTier(user.id);
            sub = await Subscription.getStats(user.id);
        }

        // 5. Async background notification email (Don't await to block response)
        sendLoginEmail(user.email).catch(err => console.error("Email Notification Error:", err));

        // 6. Return verified payload response
        return res.status(200).json({
            success: true,
            token: data.session?.access_token,
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || "",
                subscription: {
                    plan: sub?.plan_type || "free",
                    used: sub?.current_usage || 0,
                    limit: sub?.usage_limit || 0,
                    remaining: Math.max(0, (sub?.usage_limit || 0) - (sub?.current_usage || 0))
                }
            }
        });

    } catch (error) {
        console.error("Login Failure:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const { error } =
            await supabase.auth.resend({
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

        const {
            name,
            email,
            password,
            role,
            acceptedPolicy,
        } = req.body;

        if (
            !name ||
            !email ||
            !password ||
            !role ||
            !acceptedPolicy
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const { data, error } =
            await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo:
                        "adjusterassist://auth/callback",
                    data: {
                        full_name: name,
                        role,
                        accepted_policies:
                            acceptedPolicy,
                    },
                },
            });

        // REAL ERROR
        if (error) {
            console.error("Signup Error:", error);

            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
        if (
            data?.user &&
            (!data.user.identities ||
                data.user.identities.length === 0)
        ) {
            return res.status(409).json({
                success: false,
                code: "EMAIL_ALREADY_EXISTS",
                message:
                    "An account with this email already exists.",
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

        console.error(
            "Signup Failure:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to create account",
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
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        // CHECK USER EXISTS FIRST
        const { data: users, error: userError } =
            await supabaseAdmin.auth.admin.listUsers();

        if (userError) {
            return res.status(500).json({
                success: false,
                message: "Unable to verify user",
            });
        }

        const existingUser = users.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email.",
            });
        }

        // SEND RESET EMAIL
        const { error } =
            await supabase.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        "adjusterassist://reset-password",
                }
            );

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Password reset email sent.",
        });

    } catch (error) {
        console.error("Forgot Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send reset email",
        });
    }
};

/**
 * Handles Password Update by verifying the incoming deep link access token
 */
const resetPassword = async (req, res) => {
    try {
        const { newPassword, accessToken } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 8 characters long.",
            });
        }

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: "Invalid reset session.",
            });
        }

        // CREATE TEMP CLIENT SESSION
        const tempClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                },
            }
        );

        // UPDATE PASSWORD
        const { error } =
            await tempClient.auth.updateUser({
                password: newPassword,
            });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Password updated successfully.",
        });

    } catch (error) {
        console.error("Reset Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error.",
        });
    }
};
const logout = async (req, res) => {
    await supabase.auth.signOut();
    return res.status(200).json({ success: true });
};

module.exports = { login, signup, forgotPassword, resetPassword, logout, resendVerification };