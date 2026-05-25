const express = require("express");
const router = express.Router();
const { getProfile, getAllProfiles, updateProfile } = require("../controllers/user.controller");
const multer = require ('multer');
const authMiddleware = require("../middlewares/auth.middleware");
const requireAAL2 = require("../middlewares/requireAAL2");

const upload = multer({ storage: multer.memoryStorage() });

// authMiddleware FIRST, then getProfile
router.get("/profile",authMiddleware ,getProfile);
router.patch("/update", authMiddleware,upload.single('avatar') , updateProfile); 
router.get("/test/:id", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from("profiles")
      .select("*")
      .eq("id", req.params.id)
      .single();

    return res.json({
      success: !error,
      data,
      error,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
// router.get("/all", authMiddleware, getAllProfiles )

module.exports = router; 