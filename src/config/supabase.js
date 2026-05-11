const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Use Service Role Key for backend administrative tasks
const SUPABASE_SERVICE_KEy = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !SUPABASE_SERVICE_KEy || !SUPABASE_ANON_KEY) {
    console.error("[❌ ERROR] Supabase credentials missing in .env file");
}

const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY);

const supabaseAdmin = createClient(supabaseUrl, SUPABASE_SERVICE_KEy, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

// Test Connection with the new 'profiles' table
(async () => {
    try {
        // We now check 'profiles' instead of 'users'
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        
        if (error) {
            console.error("[❌ DB] Supabase Connection Error:", error.message);
        } else {
            console.log("[🚀 DB] Supabase Connected: Profiles table is reachable.");
        }
    } catch (err) {
        console.error("[❌ ERROR] Unexpected Supabase Error:", err.message);
    }
})();

module.exports = { supabase, supabaseAdmin };