const express = require("express");
const router = express.Router();
const { 
    testDraft, 
    createAIDraft, 
    getRecentDrafts, 
    saveGeneratedDraft,
    AllDrafts,
    deleteDraft
} = require("../controllers/draft.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const checkUsageLimit = require("../middlewares/usageLimit");

// Health Check
router.get("/", async(req, res) => {
    res.status(200).json({ message: "Draft Route Active" });
});



router.post("/generate-test", authMiddleware, checkUsageLimit, testDraft);

router.post("/generate", authMiddleware, checkUsageLimit, createAIDraft);

router.delete("/delete/:draftId", authMiddleware, deleteDraft);

router.post("/save", authMiddleware, saveGeneratedDraft);

router.get("/recent", authMiddleware, getRecentDrafts);
router.get("/history", authMiddleware, AllDrafts); 

module.exports = router;
