const express = require("express");
const router = express.Router();
const { createDraft } = require("../controllers/draft.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", async(req, res)=>{
    res.status(200).json({message:"Success"})
})

// This makes the full URL: /api/drafts/generate
router.post("/generate", authMiddleware, createDraft);

module.exports = router;