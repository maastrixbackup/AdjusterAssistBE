const {
    supabaseAdmin,
    supabase,
    createUserClient,
} = require("../config/supabase");
const { logAuthEvent } = require("../models/log");
const Subscription = require("../models/subscription.model");
const { sendLoginEmail } = require("../services/email.service");

function decodeJwtPayload(token) {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

const refreshSession = async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                message: "Refresh token required",
            });
        }
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
        const payload = decodeJwtPayload(session.access_token);
        console.log("Session Refreshed")
        return res.status(200).json({
            success: true,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            aal: payload.aal || "aal1",
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
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Credentials missing",
            });
        }
        const normalizedEmail = email.trim().toLowerCase();

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

        const userClient = await createUserClient(
            session.access_token,
            session.refresh_token,
        );

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

        logAuthEvent(req, {
            emailAttempted: email || "",
            eventType: "LOGIN_SUCCESS",
            status: "success"
        });

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
        logAuthEvent(req, {
            emailAttempted: email || "",
            eventType: "LOGIN_FAILURE",
            status: "failed",
            failureReason: error.message
        });
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
            logAuthEvent(req, {
                emailAttempted: email || "",
                eventType: "RESEND_VERIFICATION_FAILED",
                status: "failed",
                failureReason: error.message
            });
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
        logAuthEvent(req, {
            emailAttempted: email || "",
            eventType: "RESEND_VERIFICATION_SUCCESS",
            status: "success"
        });
        return res.status(200).json({
            success: true,
            message: "Verification email resent.",
        });
    } catch (error) {
        logAuthEvent(req, {
            emailAttempted: req.body?.email || "",
            eventType: "RESEND_VERIFICATION_SERVER_CRASH",
            status: "failed",
            failureReason: error.message
        });
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

        logAuthEvent(req, {
            emailAttempted: email || "",
            eventType: "SIGNUP_SUCCESS",
            status: "success"
        });

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
            logAuthEvent(req, { emailAttempted: "", eventType: "PASSWORD_RESET_BAD_REQUEST", status: "failed", failureReason: "missing_email" });
            return res
                .status(400)
                .json({ success: false, message: "Email is required." });
        }

        // Check user exists using the admin client
        const { data: users, error: userError } =
            await supabaseAdmin.auth.admin.listUsers();
        if (userError) {
            logAuthEvent(req, { emailAttempted: email, eventType: "PASSWORD_RESET_VERIFY_ERROR", status: "failed", failureReason: userError.message });
            return res
                .status(500)
                .json({ success: false, message: "Unable to verify account." });
        }
        const existingUser = users?.users?.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (!existingUser) {
            logAuthEvent(req, { emailAttempted: email, eventType: "PASSWORD_RESET_USER_NOT_FOUND", status: "failed", failureReason: "account_does_not_exist" });
            return res
                .status(404)
                .json({ success: false, message: "No account found with this email." });
        }
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
            email.trim().toLowerCase(),
        );

        if (error) {
            logAuthEvent(req, { userId: existingUser.id, emailAttempted: email, eventType: "PASSWORD_RESET_TRIGGER_FAILED", status: "failed", failureReason: error.message });
            return res.status(400).json({ success: false, message: error.message });
        }

        logAuthEvent(req, { userId: existingUser.id, emailAttempted: email, eventType: "PASSWORD_RESET_REQUESTED", status: "success" });
        return res.status(200).json({
            success: true,
            message: "A 8-digit secure code has been sent to your email.",
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        logAuthEvent(req, { emailAttempted: req.body?.email || "", eventType: "PASSWORD_RESET_SERVER_CRASH", status: "failed", failureReason: error.message });
        return res.status(500).json({ success: false, message: "Server error." });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, token } = req.body;
        if (!email || !token) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required.",
            });
        }

        // DEV BYPASS
        if (token === "000000") {
            return res.status(200).json({
                success: true,
                message: "DEV OTP bypass successful.",
                accessToken: "dev-reset-token",
            });
        }

        const { data, error } = await supabaseAdmin.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: token.trim(),
            type: "recovery",
        });

        if (error || !data?.session?.access_token) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired recovery code.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully.",
            accessToken: data.session.access_token,
        });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        return res.status(500).json({
            success: false,
            message: "Could not verify recovery code.",
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { newPassword, accessToken } = req.body;
        if (!newPassword || newPassword.length < 8) {
            logAuthEvent(req, { emailAttempted: "", eventType: "PASSWORD_UPDATE_BAD_REQUEST", status: "failed", failureReason: "password_too_short" });
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long.",
            });
        }

        if (!accessToken) {
            logAuthEvent(req, { emailAttempted: "", eventType: "PASSWORD_UPDATE_UNAUTHORIZED", status: "failed", failureReason: "missing_access_token" });
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
            logAuthEvent(req, { emailAttempted: "", eventType: "PASSWORD_UPDATE_TOKEN_INVALID", status: "failed", failureReason: jwtError?.message || "invalid_user_session" });
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
            logAuthEvent(req, {
                userId: user.id,
                emailAttempted: user.email,
                eventType: "PASSWORD_UPDATE_SUBMISSION_FAILED",
                status: "failed",
                failureReason: updateError.message,
            });

            return res.status(400).json({
                success: false,
                message: updateError.message,
            });
        }

        await supabaseAdmin.auth.admin.signOut(user.id, "global");

        logAuthEvent(req, { userId: user.id, emailAttempted: user.email, eventType: "PASSWORD_UPDATE_SUCCESS", status: "success" });
        return res.status(200).json({
            success: true,
            message: "Password updated successfully.",
        });
    } catch (error) {
        console.error("Reset Password Error:", error);
        logAuthEvent(req, { emailAttempted: "", eventType: "PASSWORD_UPDATE_SERVER_CRASH", status: "failed", failureReason: error.message });
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
    verifyOTP,
    logout,
    resendVerification,
    verifyCallback,
    refreshSession
};
