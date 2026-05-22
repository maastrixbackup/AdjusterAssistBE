const { createUserClient, supabaseAdmin } = require("../../config/supabase");

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
    const { data, error } = await req.supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error) {
      console.log(error)
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

    // Create challenge
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

    // Verify challenge
    const { data, error } = await req.supabase.auth.mfa.verify({
      factorId: factor_id,
      challengeId: challengeData.id,
      code,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "MFA verified successfully",
      data,
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

module.exports = {
  hasVerifiedMFA,
  getPrimaryFactor,
  getMFAStatus,
  enrollMFA,
  verifyMFAEnrollment,
  challengeMFA,
  verifyMFALogin,
  resetMFA
};
