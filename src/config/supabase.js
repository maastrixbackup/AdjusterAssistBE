const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    try {
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) {
            console.error("❌ Supabase Connection Error:", error.message);
        } else {
            console.log("🚀 Supabase is connected & synced with AdjusterAssistDB");
        }
    } catch (err) {
        console.error("❌ Unexpected Supabase Error:", err.message);
    }
})();

module.exports = supabase;