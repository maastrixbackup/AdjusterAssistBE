const { verifyToken } = require("../utils/jwt");
const Subscription = require("../models/subscription.model");
const { createUserClient } = require("../config/supabase");

function getJwtPayload(token) {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        return JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        );
    } catch {
        return null;
    }
}

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
        const decoded = await verifyToken(token);

        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                message: "Invalid session. Please login again.",
            });
        }

        const jwtPayload = getJwtPayload(token);
        req.user = decoded;
        req.jwtPayload = jwtPayload;
        req.authToken = token;
        req.supabase = await createUserClient(token);

        try {
            await Subscription.checkAndResetMonthlyUsage(decoded.id);
        } catch (subErr) {
            console.error("Background Sub Sync Failed:", subErr.message);
        }

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);

        const isExpired = err.message?.includes("expired");

        return res.status(401).json({
            success: false,
            message: isExpired
                ? "Session expired. Please log in again."
                : "Authentication failed.",
        });
    }
};

module.exports = authMiddleware;