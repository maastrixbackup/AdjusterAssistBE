const { verifyToken } = require("../utils/jwt");
const Subscription = require("../models/subscription.model");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        
        // 1. Basic Header Check
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Access denied. No token provided." });
        }

        const token = authHeader.split(" ")[1];
        
        // 2. Token Verification
        const decoded = verifyToken(token);
        
        if (!decoded || !decoded.id) {
            return res.status(401).json({ success: false, message: "Invalid session. Please login again." });
        }

        // Attach decoded payload (id, email, etc.) to request
        req.user = decoded; 

        // 3. Automated Subscription Sync
        // We use 'await' here so the controller starts with the correct 'current_usage'
        try {
            await Subscription.checkAndResetMonthlyUsage(decoded.id);
        } catch (subErr) {
            // We log this but don't block the request. 
            // Better to let the user in than block them because a background sync failed.
            console.error("Background Sub Sync Failed:", subErr.message);
        }

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        
        // Clearer messaging for the Mobile App to trigger a logout/re-auth
        const isExpired = err.name === "TokenExpiredError" || err.message.includes("expired");
        return res.status(401).json({ 
            success: false, 
            message: isExpired ? "Session expired. Please log in again." : "Authentication failed." 
        });
    }
};

module.exports = authMiddleware;