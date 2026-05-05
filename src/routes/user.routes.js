const express = require("express");
const router = express.Router();
const { getProfile, getAllUsers, updateProfile } = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// authMiddleware FIRST, then getProfile
router.get("/profile",authMiddleware, getProfile);
router.patch("/update", authMiddleware, updateProfile); 
// router.get("/all", authMiddleware, getAllUsers )

module.exports = router; 