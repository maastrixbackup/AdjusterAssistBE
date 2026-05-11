const { verifyToken } = require("../utils/jwt");
const Subscription = require("../models/subscription.model");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Access denied. No token provided." });
        }
        const token = authHeader.split(" ")[1];
        // 2. Token Verification (Now calling the Supabase Async version)
        const decoded = await verifyToken(token); 
        if (!decoded || !decoded.id) {
            return res.status(401).json({ success: false, message: "Invalid session. Please login again." });
        }
        req.user = decoded; 

        // 3. Automated Subscription Sync
        try {
            // Ensure this model uses UUID for queries now, as decoded.id is a string/UUID
            await Subscription.checkAndResetMonthlyUsage(decoded.id);
        } catch (subErr) {
            console.error("Background Sub Sync Failed:", subErr.message);
        }

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        
        // Supabase error messages often include 'expired' or 'invalid signature'
        const isExpired = err.message.includes("expired");
        return res.status(401).json({ 
            success: false, 
            message: isExpired ? "Session expired. Please log in again." : "Authentication failed." 
        });
    }
};

module.exports = authMiddleware;