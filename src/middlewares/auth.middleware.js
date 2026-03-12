const { verifyToken } = require("../utils/jwt");
const Subscription = require("../models/subscription.model");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        
        const decoded = verifyToken(token);
        
        if (!decoded || !decoded.id) {
            return res.status(401).json({ success: false, message: "Unauthorized: Token payload missing user ID" });
        }

        req.user = decoded; 

        // 3. Monthly Reset Logic (Keep this inside the try block)
        // This ensures users always have an up-to-date credit count before hitting the controller
        await Subscription.checkAndResetMonthlyUsage(decoded.id);

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        // Distinguish between unauthorized and server errors
        const message = err.message.includes("expired") ? "Token expired" : "Invalid token";
        return res.status(401).json({ success: false, message });
    }
};

module.exports = authMiddleware;