const { verifyToken } = require("../utils/jwt");
const Subscription = require("../models/subscription.model");
const { createUserClient } = require("../config/supabase");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided.",
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify JWT
        const decoded = await verifyToken(token);
        // console.log("DECODED USER =>", decoded);

        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                message: "Invalid session. Please login again.",
            });
        }

        // Attach user
        req.user = decoded;

        // Attach USER-SCOPED Supabase client
        req.supabase = await createUserClient(token);

        // Background subscription sync
        try {
            await Subscription.checkAndResetMonthlyUsage(decoded.id);
        } catch (subErr) {
            console.error("Background Sub Sync Failed:", subErr.message);
        }

        next();
    } catch (err) {
        if (error.message !== "Invalid or expired token") {
            console.error("Auth Middleware Error:", error.message);
        }

        const isExpired = err.message.includes("expired");

        return res.status(401).json({
            success: false,
            message: isExpired
                ? "Session expired. Please log in again."
                : "Authentication failed.",
        });
    }
};

module.exports = authMiddleware;