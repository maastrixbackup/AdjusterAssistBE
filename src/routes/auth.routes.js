const express = require("express");
const router = express.Router();

// Import your auh controller
const { login, signup, forgotPassword, resetPassword } = require("../controllers/auth.controller");

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;