const { createUserClient, supabaseAdmin, supabase } = require("../config/supabase");
const { logAuthEvent } = require("../models/log");
const Subscription = require("../models/subscription.model");
const { sendLoginEmail } = require("../services/email.service");
const { generateMFARecoveryCodes, verifyAndConsumeRecoveryCode, deleteAllUserMFAFactors } = require("../services/mfa/recoveryCode");

async function hasVerifiedMFA(accessToken) {
  const client = createUserClient(accessToken);
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) {
    throw new Error(error.message);
  }
  const verifiedFactors =
    data?.totp?.filter((f) => f.status === "verified") || [];
  return verifiedFactors.length > 0;
}

const getMFAStatus = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const aal = user.aal || "aal1";
    return res.status(200).json({
      success: true,

      current_level: aal,

      next_level: aal === "aal2" ? "aal2" : "aal2",

      mfa_enabled: aal === "aal2",

      mfa_verified: aal === "aal2",

      amr: user.amr || [],
    });
  } catch (error) {
    console.error("MFA Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get MFA status",
    });
  }
};

async function getPrimaryFactor(accessToken) {
  const client = createUserClient(accessToken);
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) {
    throw new Error(error.message);
  }
  const factor = data.totp.find((factor) => factor.status === "verified");
  return factor || null;
}


const enrollMFA = async (req, res) => {
  try {
    const { data: factorData, error: listError } =
      await req.supabase.auth.mfa.listFactors();

    if (listError) {
      return res.status(400).json({
        success: false,
        message: listError.message,
      });
    }

    const totpFactors = factorData?.totp || [];

    const verifiedFactor = totpFactors.find(
      (factor) => factor.status === "verified"
    );

    if (verifiedFactor) {
      return res.status(409).json({
        success: false,
        code: "MFA_ALREADY_ENABLED",
        message: "MFA is already enabled for this account.",
      });
    }

    const unverifiedFactors = totpFactors.filter(
      (factor) => factor.status !== "verified"
    );

    for (const factor of unverifiedFactors) {
      await req.supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
    }

    const { data, error } =
      await req.supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `AdjusterAssist-${Date.now()}`,
        issuer: "AdjusterAssist",
      });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      factor_id: data.id,
      qr_code: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  } catch (error) {
    console.error("Enroll MFA Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to enroll MFA",
    });
  }
};

const verifyMFAEnrollment = async (req, res) => {
  try {
    const { factor_id, code } = req.body;

    if (!factor_id || !code) {
      logAuthEvent(req, { emailAttempted: req.user?.email || "", eventType: "MFA_ENROLL_BAD_REQUEST", status: "failed", failureReason: "missing_factor_id_or_code" });
      return res.status(400).json({
        success: false,
        message: "factor_id and code required",
      });
    }

    /*
      STEP 1
      Create MFA challenge
    */

    const { data: challengeData, error: challengeError } =
      await req.supabase.auth.mfa.challenge({
        factorId: factor_id,
      });

    if (challengeError) {
      logAuthEvent(req, { emailAttempted: req.user?.email || "", eventType: "MFA_ENROLL_CHALLENGE_FAILED", status: "failed", failureReason: challengeError.message, mfaDetails: { factor_id } });
      return res.status(400).json({
        success: false,
        message: challengeError.message,
      });
    }

    /*
      STEP 2
      Verify MFA code
    */

    const { data, error } =
      await req.supabase.auth.mfa.verify({
        factorId: factor_id,
        challengeId: challengeData.id,
        code,
      });

    if (error || !data?.user) {
      logAuthEvent(req, {
        emailAttempted: req.user?.email || "",
        eventType: "MFA_ENROLLMENT_FAILED",
        status: "failed",
        failureReason: error?.message || "missing_user_data",
        mfaDetails: { factor_id }
      });
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to verify MFA",
      });
    }

    /*
      STEP 3
      Generate recovery codes
    */

    const recoveryCodes =
      await generateMFARecoveryCodes(data.user.id);

    /*
      STEP 4
      Success response
    */
    const accessToken = data.session?.access_token || data.access_token;
    const refreshToken = data.session?.refresh_token || data.refresh_token;
    const expiresAt = data.session?.expires_at || data.expires_at;
    const user = data.session?.user || data?.user;

    if (!accessToken || !refreshToken) {
      logAuthEvent(req, { userId: user.id, emailAttempted: user.email, eventType: "MFA_ENROLLMENT_TOKEN_ERROR", status: "failed", failureReason: "missing_session_tokens" });
      return res.status(500).json({
        success: false,
        message: "MFA verified but session tokens were not returned",
      });
    }

    logAuthEvent(req, {
      userId: user.id,
      emailAttempted: user.email,
      eventType: "MFA_ENROLLMENT_SUCCESS",
      status: "success",
      mfaDetails: { factor_id }
    });
    return res.status(200).json({
      success: true,
      message: "MFA verified successfully",
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || "",
      },
      recovery_codes: recoveryCodes,
    });

  } catch (error) {
    console.error("Verify MFA Error:", error);
    logAuthEvent(req, { emailAttempted: req.user?.email || "", eventType: "MFA_ENROLLMENT_SERVER_CRASH", status: "failed", failureReason: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to verify MFA",
    });
  }
};    

const challengeMFA = async (req, res) => {
  try {
    const { factor_id, temp_access_token, temp_refresh_token } = req.body;
    if (!factor_id || !temp_access_token) {
      return res.status(400).json({
        success: false,
        message: "Missing MFA session data",
      });
    }

    // Create temporary user-scoped client
    const client = await createUserClient(
      temp_access_token,
      temp_refresh_token,
    );

    // Create MFA challenge
    const { data, error } = await client.auth.mfa.challenge({
      factorId: factor_id,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      challenge_id: data.id,
      message: "MFA challenge created successfully.",
    });
  } catch (error) {
    console.error("MFA Challenge Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create MFA challenge",
    });
  }
};

const verifyMFALogin = async (req, res) => {
  const emailContext = req.body.email || "";

  try {
    const {
      factor_id,
      challenge_id,
      code,
      temp_access_token,
      temp_refresh_token,
    } = req.body;

    // 1. Handle Missing Payload Fields Log
    if (!factor_id || !challenge_id || !code || !temp_access_token) {
      logAuthEvent(req, {
        emailAttempted: emailContext,
        eventType: "MFA_BAD_REQUEST",
        status: "failed",
        failureReason: "missing_required_fields"
      });
      return res.status(400).json({
        success: false,
        message: "Missing MFA verification data",
      });
    }

    // Create temporary session client
    const client = await createUserClient(
      temp_access_token,
      temp_refresh_token,
    );

    // VERIFY MFA LOGIN
    const { data, error } = await client.auth.mfa.verify({
      factorId: factor_id,
      challengeId: challenge_id,
      code,
    });

    // 2. Handle Explicit Verification Failure Log (e.g., Wrong Code entered)
    if (error) {
      logAuthEvent(req, {
        emailAttempted: emailContext,
        eventType: "MFA_CHALLENGE_FAILED",
        status: "failed",
        failureReason: error.message,
        mfaDetails: { factor_id, challenge_id }
      });
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // FINAL AAL2 SESSION DATA
    const access_token = data?.access_token;
    const refresh_token = data?.refresh_token;
    const expires_at = data?.expires_at;
    const user = data?.user;

    // NORMAL NON-MFA LOGIN TASKS
    let sub = await Subscription.getStats(user.id);
    if (!sub) {
      await Subscription.initFreeTier(user.id);
      sub = await Subscription.getStats(user.id);
    }

    sendLoginEmail(user.email).catch((err) =>
      console.error("Email Notification Error:", err),
    );

    // 3. Perfect Log: Authenticated Session Achieved
    logAuthEvent(req, {
      userId: user.id,
      emailAttempted: user.email,
      eventType: "MFA_LOGIN_SUCCESS",
      status: "success",
      mfaDetails: { resolved_aal: "aal2", factor_id }
    });

    return res.status(200).json({
      success: true,
      message: "MFA login successful",
      access_token,
      refresh_token,
      expires_at,
      aal: "aal2",
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || "",
      },
    });

  } catch (error) {
    console.error("Verify MFA Login Error:", error);

    // 4. Global Fallback Catch Log
    logAuthEvent(req, {
      emailAttempted: emailContext,
      eventType: "MFA_SERVER_CRASH",
      status: "failed",
      failureReason: error.message
    });

    return res.status(500).json({
      success: false,
      message: "Failed to verify MFA login",
    });
  }
};

// After loggedin
const resetMFA = async (req, res) => {
  try {
    const user = req.user;

    const { password, factor_id, code } = req.body;

    if (!password || !factor_id || !code) {
      return res.status(400).json({
        success: false,
        message: "password, factor_id and code required",
      });
    }

    /*
    STEP 1:
    Re-authenticate password
    */

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: user.email,
        password,
      });

    if (authError || !authData?.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    /*
    STEP 2:
    Verify current MFA code
    */

    const { data: challengeData, error: challengeError } =
      await req.supabase.auth.mfa.challenge({
        factorId: factor_id,
      });

    if (challengeError) {
      return res.status(400).json({
        success: false,
        message: challengeError.message,
      });
    }

    const { error: verifyError } = await req.supabase.auth.mfa.verify({
      factorId: factor_id,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      return res.status(401).json({
        success: false,
        message: "Invalid MFA code",
      });
    }

    /*
    STEP 3:
    Unenroll factor
    */

    const { error: removeError } = await req.supabase.auth.mfa.unenroll({
      factorId: factor_id,
    });

    if (removeError) {
      return res.status(400).json({
        success: false,
        message: removeError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "MFA removed successfully",
    });
  } catch (error) {
    console.error("Reset MFA Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset MFA",
    });
  }
};

// During login
const resetMFALogin = async (req, res) => {
  try {
    const { email, password, temp_access_token } = req.body;
    if (!email || !password || !temp_access_token) {
      return res.status(400).json({
        success: false,
        message: "Missing credentials",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Verify password using normal Supabase client
    const { data: passwordData, error: passwordError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (passwordError || !passwordData?.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // 2. Validate temp token belongs to same user
    const userClient = await createUserClient(temp_access_token);

    const { data: tempUserData, error: tempUserError } =
      await userClient.auth.getUser();

    if (tempUserError || !tempUserData?.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid reset session",
      });
    }

    if (
      tempUserData.user.id !== passwordData.user.id ||
      tempUserData.user.email?.toLowerCase() !== normalizedEmail
    ) {
      return res.status(403).json({
        success: false,
        message: "Session does not match this account",
      });
    }

    // 3. List existing MFA factors
    const { data: factorData, error: factorError } =
      await userClient.auth.mfa.listFactors();

    if (factorError) {
      return res.status(400).json({
        success: false,
        message: factorError.message,
      });
    }

    const factors = factorData?.totp || [];

    // 4. Remove every TOTP factor
    const failedFactors = [];

    for (const factor of factors) {
      const { error: unenrollError } =
        await userClient.auth.mfa.unenroll({
          factorId: factor.id,
        });

      if (unenrollError) {
        failedFactors.push({
          factor_id: factor.id,
          message: unenrollError.message,
        });
      }
    }

    if (failedFactors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some MFA factors could not be removed.",
        failed_factors: failedFactors,
      });
    }

    // 5. Verify cleanup
    const { data: afterResetFactors, error: afterResetError } =
      await userClient.auth.mfa.listFactors();

    if (afterResetError) {
      return res.status(400).json({
        success: false,
        message: afterResetError.message,
      });
    }

    const remainingTotpFactors = afterResetFactors?.totp || [];

    if (remainingTotpFactors.length > 0) {
      return res.status(409).json({
        success: false,
        code: "MFA_RESET_PENDING",
        message:
          "MFA reset is still processing. Please try logging in again after a moment.",
      });
    }



    // 6. Do not return new tokens. Force clean login.
    return res.status(200).json({
      success: true,
      requires_relogin: true,
      message: "MFA reset successful. Please login again.",
    });
  } catch (error) {
    console.error("Reset MFA Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset MFA",
    });
  }
};

const requestMFARecovery = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id || !user?.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid recovery session",
      });
    }

    const normalizedEmail = user.email.trim().toLowerCase();

    const { data: existingRequest } = await supabaseAdmin
      .from("mfa_recovery_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingRequest) {
      return res.status(200).json({
        success: true,
        message: "A recovery request is already pending review.",
      });
    }

    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("mfa_recovery_requests")
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        status: "pending",
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("MFA recovery insert error:", insertError);

      return res.status(500).json({
        success: false,
        message: "Failed to create recovery request",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Your MFA recovery request has been submitted for review.",
    });
  } catch (error) {
    console.error("requestMFARecovery error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process recovery request",
    });
  }
};

const recoveryCodeLogin = async (req, res) => {
  try {
    const { recovery_code } = req.body;

    if (!recovery_code) {
      logAuthEvent(req, { emailAttempted: req.user?.email || "", eventType: "RECOVERY_CODE_BAD_REQUEST", status: "failed", failureReason: "missing_recovery_code" });
      return res.status(400).json({
        success: false,
        message: "Recovery code is required",
      });
    }

    const user = req.user;

    if (!user?.id || !user?.email) {
      logAuthEvent(req, { emailAttempted: "", eventType: "RECOVERY_CODE_INVALID_SESSION", status: "failed", failureReason: "missing_user_session_context" });
      return res.status(401).json({
        success: false,
        message: "Invalid recovery session",
      });
    }

    const recoveryResult = await verifyAndConsumeRecoveryCode({
      userId: user.id,
      recoveryCode: recovery_code,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (!recoveryResult.valid) {
      logAuthEvent(req, { userId: user.id, emailAttempted: user.email, eventType: "RECOVERY_CODE_FAILED", status: "failed", failureReason: "invalid_or_consumed_code" });
      return res.status(401).json({
        success: false,
        message: "Invalid or already used recovery code",
      });
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Recovery magic link error:", linkError);
      logAuthEvent(req, { userId: user.id, emailAttempted: user.email, eventType: "RECOVERY_LINK_GENERATION_FAILED", status: "failed", failureReason: linkError?.message || "missing_hashed_token" });
      return res.status(500).json({
        success: false,
        message: "Failed to generate recovery session",
      });
    }

    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.verifyOtp({
        type: "magiclink",
        token_hash: linkData.properties.hashed_token,
      });

    if (sessionError || !sessionData?.session) {
      console.error("Recovery session error:", sessionError);
      logAuthEvent(req, { userId: user.id, emailAttempted: user.email, eventType: "RECOVERY_OTP_VERIFICATION_FAILED", status: "failed", failureReason: sessionError?.message || "missing_session" });
      return res.status(500).json({
        success: false,
        message: "Failed to create recovery login session",
      });
    }

    const session = sessionData.session;

    logAuthEvent(req, { userId: sessionData.user.id, emailAttempted: sessionData.user.email, eventType: "RECOVERY_CODE_LOGIN_SUCCESS", status: "success" });
    return res.status(200).json({
      success: true,
      recovery_used: true,
      requires_mfa: false,
      requires_mfa_setup: false,

      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,

      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
      },

      message: "Recovery code accepted. Login successful.",
    });
  } catch (error) {
    console.error("Recovery Code Login Error:", error);
    logAuthEvent(req, { emailAttempted: req.user?.email || "", eventType: "RECOVERY_CODE_SERVER_CRASH", status: "failed", failureReason: error.message });
    return res.status(500).json({
      success: false,
      message: "Recovery login failed",
    });
  }
};

module.exports = {
  hasVerifiedMFA,
  getPrimaryFactor,
  getMFAStatus,
  enrollMFA,
  verifyMFAEnrollment,
  challengeMFA,
  verifyMFALogin,
  resetMFA,
  resetMFALogin,
  requestMFARecovery,
  recoveryCodeLogin
};
