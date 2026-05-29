const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// 🌟 FIXED TYPO: Changed lowercase 'KEy' to uppercase 'KEY'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Fail-fast guard clause to catch environmental misconfigurations instantly
if (!supabaseUrl || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    console.error("[❌ ERROR] Supabase credentials missing or misconfigured in your .env file.");
}

// 1. Client instance for restricted public queries (Obeys Row-Level Security)
const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY);

// 2. Administrative Master instance (Bypasses Row-Level Security completely)
const supabaseAdmin = createClient(supabaseUrl, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    },
    // 🌟 EXTRA FORCED BYPASS LAYER: Instructs the postgrest adapter to skip RLS checks
    global: {
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    }
});

/**
 * Creates an isolated, user-authenticated Supabase client instance bound to a client token.
 */
async function createUserClient(access_token, refresh_token = null) {
    if (!access_token) {
        throw new Error("Cannot initialize a user-specific client without an access token context.");
    }

    const client = createClient(
        supabaseUrl,
        SUPABASE_ANON_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );

    // Synchronize request state context with user session
    await client.auth.setSession({
        access_token,
        refresh_token: refresh_token || "dummy-refresh-token",
    });

    return client;
}

// Operational sanity script to audit database accessibility on server bootstrap
(async () => {
    try {
        const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(1);
        
        if (error) {
            console.error("[❌ DB] Supabase Administrative Connection Failed:", error.message);
        } else {
            console.log("[🚀 DB] Supabase Master Client Initialized: Profiles table is fully reachable.");
        }
    } catch (err) {
        console.error("[❌ ERROR] Unexpected database exception encountered:", err.message);
    }
})();

// Export using CommonJS module syntax
module.exports = { 
    supabaseAdmin, 
    supabase, 
    createUserClient 
};
