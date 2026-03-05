const { verifyToken } = require("../utils/jwt");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = verifyToken(token);
        
        if (!decoded || !decoded.id) {
            console.log("Payload Check Failed. Content:", decoded);
            return res.status(401).json({ success: false, message: "Invalid Token Payload" });
        }

        // This is the bridge to your controller
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: "Auth Error" });
    }
};

module.exports = authMiddleware;
