const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, 
    message: "Too many reset attempts, please try again after 15 minutes"
});

// Import your auh controller
const { login, signup, forgotPassword, resetPassword, verifyOTP } = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", resetLimiter, forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/logout", authMiddleware, (req, res) => {
    res.status(200).json({ success: true, message: "Logout successful" });
});

module.exports = router;