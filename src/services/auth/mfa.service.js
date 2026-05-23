const { createUserClient, supabaseAdmin, supabase } = require("../../config/supabase");
const { generateMFARecoveryCodes, verifyAndConsumeRecoveryCode, deleteAllUserMFAFactors } = require("./recoveryCode");

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

    return res.status(200).json({
      success: true,
      message: "MFA verified successfully",

      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },

      recovery_codes: recoveryCodes,
    });

  } catch (error) {

    console.error("Verify MFA Error:", error);

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
  try {
    const {
      factor_id,
      challenge_id,
      code,
      temp_access_token,
      temp_refresh_token,
    } = req.body;

    if (!factor_id || !challenge_id || !code || !temp_access_token) {
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

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // FINAL AAL2 SESSION
    const access_token = data?.access_token;
    const refresh_token = data?.refresh_token;
    const expires_at = data?.expires_at;
    const user = data?.user;
    console.log(
      "MFA VERIFY RESPONSE:",
      JSON.stringify({ data, error }, null, 2),
    );

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
      return res.status(400).json({
        success: false,
        message: "Recovery code is required",
      });
    }

    const user = req.user;

    if (!user?.id || !user?.email) {
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
      return res.status(401).json({
        success: false,
        message: "Invalid or already used recovery code",
      });
    }

    const removedFactorsCount =
      await deleteAllUserMFAFactors(user.id);


    return res.status(200).json({
      success: true,
      recovery_used: true,
      requires_mfa_setup: true,
      removed_factors_count: removedFactorsCount,
      message:
        "Recovery code accepted. Please setup MFA again.",
    });
  } catch (error) {
    console.error("Recovery Code Login Error:", error);

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
