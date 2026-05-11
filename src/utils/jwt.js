const supabase = require("../config/supabase");
const verifyToken = async (token) => {
    try {
        // We call getUser(token) which verifies the JWT with Supabase Auth servers
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            throw new Error(error?.message || "Invalid session");
        }

        // Return a payload compatible with your existing code
        return {
            id: user.id,
            email: user.email,
        };
    } catch (error) {
        throw new Error(error.message);
    }
};

module.exports = { verifyToken };