const express = require("express");
const router = express.Router();
const {
    testDraft,
    createAIDraft,
    getRecentDrafts,
    AllDrafts,
    deleteDraft,
    updateDraft,
    testCreateMessage,
    createVariantDraft,
    refineAIDraft,
    getAttachmentPreview
} = require("../controllers/message.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const checkUsageLimit = require("../middlewares/usageLimit");
const multer = require('multer');
const requireAAL2 = require("../middlewares/requireAAL2");
const upload = multer({ dest: 'uploads/' });

// Health Check
router.get("/", async (req, res) => {
    res.status(200).json({ message: "Draft Route Active" });
});


router.post("/test", authMiddleware, testCreateMessage);
router.get(
    "/:messageId/attachments/:type",
    authMiddleware,
    getAttachmentPreview
);

router.post("/generate", authMiddleware, requireAAL2 ,checkUsageLimit, (req, res, next) => {
    upload.array('attachments')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: `Multer Error: ${err.message}. Expected field name: 'attachments'`
            });
        } else if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        next();
    });
}, createAIDraft);

router.post("/variant", authMiddleware, requireAAL2, checkUsageLimit, createVariantDraft);

router.post("/refine", authMiddleware, requireAAL2, checkUsageLimit, refineAIDraft);

// router.post('/generate-next-step', authMiddleware, checkUsageLimit, generateNextStepDraft);

router.delete("/delete/:draftId", authMiddleware, deleteDraft);
// router.post("/save", authMiddleware, saveGeneratedDraft);
router.get("/recent", authMiddleware, getRecentDrafts);
router.get("/history", authMiddleware, AllDrafts);

router.patch("/update/:draftId", authMiddleware, requireAAL2, updateDraft)

module.exports = router;
