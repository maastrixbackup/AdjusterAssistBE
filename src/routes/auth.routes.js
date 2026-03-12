const express = require("express");
const router = express.Router();

// Import your auh controller
const { login, signup, forgotPassword, resetPassword } = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/logout", authMiddleware, (req, res) => {
    res.status(200).json({ success: true, message: "Logout successful" });
});

module.exports = router;