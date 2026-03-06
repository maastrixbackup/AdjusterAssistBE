const express = require("express");
const router = express.Router();
const { getProfile, getAllUsers } = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// authMiddleware FIRST, then getProfile
router.get("/profile", authMiddleware, getProfile);
router.get("/all", authMiddleware, getAllUsers )

module.exports = router;