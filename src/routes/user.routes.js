const express = require("express");
const router = express.Router();
const { getProfile, getAllUsers, updateProfile } = require("../controllers/user.controller");
const multer = require ('multer');
const authMiddleware = require("../middlewares/auth.middleware");

const upload = multer({ storage: multer.memoryStorage() });

// authMiddleware FIRST, then getProfile
router.get("/profile",authMiddleware, getProfile);
router.patch("/update", authMiddleware,upload.single('avatar') , updateProfile); 
// router.get("/all", authMiddleware, getAllUsers )

module.exports = router; 