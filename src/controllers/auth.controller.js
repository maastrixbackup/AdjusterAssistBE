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
            return res.status(400).json({
                success: false,
                message: "Credentials missing"
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        // Authenticate user
        const { data, error } =
            await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            });

        // Auth failed
        if (error) {

            if (
                error.message
                    ?.toLowerCase()
                    .includes("email not confirmed")
            ) {
                return res.status(403).json({
                    success: false,
                    code: "EMAIL_NOT_VERIFIED",
                    message:
                        "Please verify your email before logging in.",
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

        // Subscription init
        let sub =
            await Subscription.getStats(user.id);

        if (!sub) {

            console.log(
                `🚀 First login for ${user.email}. Initializing subscription...`
            );

            await Subscription.initFreeTier(user.id);

            sub =
                await Subscription.getStats(user.id);
        }

        // Background email
        sendLoginEmail(user.email)
            .catch(err =>
                console.error(
                    "Email Notification Error:",
                    err
                )
            );

        // SUCCESS RESPONSE
        return res.status(200).json({

            success: true,

            access_token:
                session.access_token,

            refresh_token:
                session.refresh_token,

            expires_at:
                session.expires_at,
            token: session.access_token,

            user: {
                id: user.id,
                email: user.email,
                name:
                    user.user_metadata?.full_name || "",
                subscription: {
                    plan: sub?.plan_type || "free",
                    used:
                        sub?.current_usage || 0,
                    limit:
                        sub?.usage_limit || 0,

                    remaining: Math.max(
                        0,
                        (sub?.usage_limit || 0)
                        -
                        (sub?.current_usage || 0)
                    )
                }
            }
        });
    } catch (error) {
        console.error(
            "Login Failure:",
            error
        );
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
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
                        "adjusterassist://callback",
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

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

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
        userId: user.id            
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
                    redirectTo: "adjusterassist://reset-password",
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
        message: "Password must be at least 8 characters long.",
      });
    }
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired reset session parameters.",
      });
    }
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(accessToken);

    if (jwtError || !user) {
      return res.status(401).json({
        success: false,
        message: "Reset link has expired or session is invalid.",
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json({
        success: false,
        message: updateError.message,
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
      message: "Server error encountered while updating credentials.",
    });
  }
};

const logout = async (req, res) => {
    await supabase.auth.signOut();
    return res.status(200).json({ success: true });
};

module.exports = { login, signup, forgotPassword, resetPassword, logout, resendVerification, verifyCallback };