// utils/creditHelper.js
const { supabaseAdmin } = require("../config/supabase");

const deductCredits = async (userId, actionType, workspaceName = 'Main Workspace', creditsToDeduct = 1) => {
  try {
    const { error: rpcError } = await supabaseAdmin.rpc('increment_subscription_usage', {
      target_user_id: userId
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    const { error: logError } = await supabaseAdmin
      .from('credit_logs')
      .insert([
        {
          user_id: userId,
          workspace_name: workspaceName,
          action_type: actionType,
          credits_deducted: creditsToDeduct
        }
      ]);

    if (logError) {
      console.error(`[⚠️ WARNING] Credit deducted but logging failed: ${logError.message}`);
    }

    return { success: true };

  } catch (error) {
    console.error(`[❌ CREDIT FAILURE] Operational block: ${error.message}`);
    return { success: false, reason: error.message };
  }
};

module.exports = { deductCredits };