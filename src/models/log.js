
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
    const { ip, ua } = getClientMetadata(req);

    // 🌟 CHANGED FROM supabase TO supabaseAdmin TO PASS RLS POLICIES
    supabaseAdmin
        .from("auth_logs")
        .insert({
            user_id: userId,
            email_attempted: emailAttempted?.toLowerCase().trim(),
            event_type: eventType.toUpperCase(),
            status: status.toLowerCase(),
            failure_reason: failureReason,
            ip_address: ip,
            user_agent: ua,
            mfa_details: mfaDetails,
        })
        .then(({ error }) => {
            if (error) console.error("❌ [SUPABASE AUTH LOG ERROR]:", error.message);
        });
};

export const logSystemEvent = async (req, {
    userId = null,
    eventType,
    category,
    payload = {},
}) => {
    // Dynamically pull network indicators from the incoming request object if available
    let ip = null;
    let ua = null;
    
    if (req) {
        ip = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || null;
        if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();
        if (ip === "::1" || ip === "127.0.0.1") ip = "127.0.0.1";
        if (ip && ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");
        
        ua = req.headers?.["user-agent"] || null;
    }

    // Fire-and-forget background push
    supabaseAdmin
        .from("system_logs")
        .insert({
            user_id: userId || req?.user?.id || null, // Fallback to middleware user session if not explicitly provided
            event_type: eventType.toUpperCase(),
            category: category.toLowerCase(),
            ip_address: ip,
            user_agent: ua,
            payload: payload,
        })
        .then(({ error }) => {
            if (error) console.error("❌ [SUPABASE SYSTEM LOG ERROR]:", error.message);
        });
};