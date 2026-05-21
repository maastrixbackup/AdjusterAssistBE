const requireAAL2 = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    if (req.user.aal !== "aal2") {
        return res.status(403).json({
            success: false,
            code: "MFA_REQUIRED",
            message: "Multi-factor authentication required",
        });
    }

    next();
};

module.exports = requireAAL2;