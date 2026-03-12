const express = require("express");
const router = express.Router();
const { createDraft } = require("../controllers/draft.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const checkUsageLimit = require("../middlewares/usageLimit");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"Success"})
})

// This makes the full URL: /api/drafts/generate
router.post("/generate", authMiddleware, checkUsageLimit, createDraft);

module.exports = router;