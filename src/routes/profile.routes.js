const express = require("express");
const router = express.Router();
const { getProfile, getAllProfiles, updateProfile, deleteAccount } = require("../controllers/user.controller");
const multer = require ('multer');
const authMiddleware = require("../middlewares/auth.middleware");
const requireAAL2 = require("../middlewares/requireAAL2");

const upload = multer({ storage: multer.memoryStorage() });

// authMiddleware FIRST, then getProfile
router.get("/profile",authMiddleware ,getProfile);
router.patch("/update", authMiddleware, requireAAL2, upload.single('avatar') , updateProfile); 
router.delete("/delete-account", authMiddleware, requireAAL2, deleteAccount);
// router.get("/all", authMiddleware, getAllProfiles )

module.exports = router; 