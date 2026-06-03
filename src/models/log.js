import { supabaseAdmin } from "../config/supabase.js"; 

export const getClientMetadata = (req) => {
    if (!req) return { ip: null, ua: null };

    let ip = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || null;
    if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();
    if (ip === "::1" || ip === "127.0.0.1") ip = "127.0.0.1";
    if (ip && ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

    const ua = req.headers?.["user-agent"] || null;
    return { ip, ua };
};

export const logAuthEvent = async (req, {
    userId = null,
    emailAttempted,
    eventType,
    status,
    failureReason = null,
    mfaDetails = {},
}) => {
    try {
        const { ip, ua } = getClientMetadata(req);

        const { data, error } = await supabaseAdmin
            .from("auth_logs")
            .insert({
                user_id: userId,
                email_attempted: emailAttempted ? emailAttempted.toLowerCase().trim() : null,
                event_type: eventType ? eventType.toUpperCase() : "UNKNOWN",
                status: status ? status.toLowerCase() : "unknown",
                failure_reason: failureReason,
                ip_address: ip,
                user_agent: ua,
                mfa_details: mfaDetails,
            })
            .select();

        if (error) {
            console.error("[SUPABASE DATABASE ERROR]: INSERT to 'auth_logs' rejected:", error);
            return false;
        }

        return true;
    } catch (err) {
        console.error("💥 [LOG AUTH CRITICAL FAIL]: Logger execution crashed:", err.message);
        return false;
    }
};

export const logSystemEvent = async (req, {
    userId = null,
    eventType,
    category,
    payload = {},
}) => {

    try {
        let ip = null;
        let ua = null;
        
        if (req) {
            ip = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || null;
            if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();
            if (ip === "::1" || ip === "127.0.0.1") ip = "127.0.0.1";
            if (ip && ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");
            
            ua = req.headers?.["user-agent"] || null;
        }

        const { data, error } = await supabaseAdmin
            .from("system_logs")
            .insert({
                user_id: userId || req?.user?.id || null,
                event_type: eventType ? eventType.toUpperCase() : "UNKNOWN",
                category: category ? category.toLowerCase() : "general",
                ip_address: ip,
                user_agent: ua,
                payload: payload,
            })
            .select();

        if (error) {
            console.error("❌ [SUPABASE DATABASE ERROR]: INSERT to 'system_logs' rejected:", error);
            return false;
        }

        return true;
    } catch (err) {
        console.error("💥 [LOG SYSTEM CRITICAL FAIL]: Logger execution crashed:", err.message);
        return false;
    }
};